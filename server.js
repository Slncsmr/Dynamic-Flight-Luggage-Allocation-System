import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import authRoutes from './routes/auth.js';
import auth from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/flight', auth);
app.use('/api/cargo', auth);

// Serve dashboard.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Database connection
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: "cargo_db",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// Initialize flight with cargo capacity
app.post("/api/flight/initialize", (req, res) => {
  const { flightId, totalCapacity = 20000 } = req.body; // Default 20000kg capacity

  const query = `INSERT INTO flights (flight_id, total_capacity, remaining_capacity) 
                   VALUES (?, ?, ?)`;

  connection.query(
    query,
    [flightId, totalCapacity, totalCapacity],
    (err, result) => {
      if (err) {
        console.error("Error initializing flight:", err);
        res.status(500).json({ error: "Failed to initialize flight", details: err.message });
        return;
      }
      res.json({
        message: "Flight initialized successfully",
        flightId,
        totalCapacity,
        remainingCapacity: totalCapacity,
      });
    }
  );
});

// Handle passenger cargo check-in with unused allowance redistribution
app.post("/api/cargo/check-in", (req, res) => {
  const { flightId, passengerId, weight } = req.body;
  const standardWeight = 35; // Standard weight limit in kg
  const baseRate = 100; // Base price per passenger

  // Get current flight info
  connection.query(
    "SELECT * FROM flights WHERE flight_id = ?",
    [flightId],
    (err, flights) => {
      if (err) {
        return res.status(500).json({ error: "Database error (flights)" });
      }

      if (flights.length === 0) {
        return res.status(404).json({ error: "Flight not found" });
      }

      const flight = flights[0];
      const remainingCapacity = flight.remaining_capacity;

      if (weight > remainingCapacity) {
        return res.status(400).json({
          error: "Exceeds remaining capacity",
          remainingCapacity,
        });
      }

      // Get previous check-ins to calculate unused allowance
      connection.query(
        "SELECT weight FROM cargo_checkins WHERE flight_id = ?",
        [flightId],
        (checkInErr, checkIns) => {
          if (checkInErr) {
            return res
              .status(500)
              .json({ error: "Database error (check-ins)" });
          }

          // Calculate unused allowance from past check-ins
          const unusedAllowance = checkIns.reduce((sum, record) => {
            return sum + Math.max(0, standardWeight - record.weight);
          }, 0);

          let extraWeight = Math.max(0, weight - standardWeight);
          let coveredByPool = Math.min(extraWeight, unusedAllowance);
          let chargeableExtra = extraWeight - coveredByPool;

          // Calculate price
          let price = baseRate;
          if (chargeableExtra > 0) {
            price += chargeableExtra * (baseRate * 1.5); // 50% surcharge
          } else if (weight < standardWeight) {
            const capacityUtilization =
              (flight.total_capacity - remainingCapacity) /
              flight.total_capacity;
            if (capacityUtilization < 0.5) {
              price *= 0.8; // 20% discount
            }
          }

          // Update remaining capacity and insert check-in
          const newRemainingCapacity = remainingCapacity - weight;

          connection.query(
            "UPDATE flights SET remaining_capacity = ? WHERE flight_id = ?",
            [newRemainingCapacity, flightId],
            (updateErr) => {
              if (updateErr) {
                return res
                  .status(500)
                  .json({ error: "Failed to update flight capacity" });
              }

              // Insert check-in record
              const insertQuery = `
                                INSERT INTO cargo_checkins 
                                (flight_id, passenger_id, weight, price) 
                                VALUES (?, ?, ?, ?)
                            `;

              connection.query(
                insertQuery,
                [flightId, passengerId, weight, price],
                (insertErr) => {
                  if (insertErr) {
                    console.error('Check-in error details:', insertErr);
                    return res
                      .status(500)
                      .json({ error: "Failed to record check-in", details: insertErr.message });
                  }

                  res.json({
                    message: "Cargo checked in successfully",
                    checkedInWeight: weight,
                    extraWeight,
                    coveredByPool,
                    chargedWeight: chargeableExtra,
                    price,
                    remainingCapacity: newRemainingCapacity,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Get all initialized flights
app.get("/api/flights", (req, res) => {
  connection.query(
    "SELECT * FROM flights ORDER BY created_at DESC",
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Database error fetching flights" });
      }
      res.json(results);
    }
  );
});

// Get flight cargo status + number of travelers + average weight
app.get('/api/flight/:flightId/status', (req, res) => {
  const { flightId } = req.params;

  const flightQuery = 'SELECT * FROM flights WHERE flight_id = ?';
  const statsQuery = `
      SELECT 
          COUNT(*) AS numTravelers,
          COALESCE(AVG(weight), 0) AS avgWeight
      FROM cargo_checkins
      WHERE flight_id = ?
  `;

  connection.query(flightQuery, [flightId], (err, flights) => {
      if (err) {
          return res.status(500).json({ error: 'Database error' });
      }

      if (flights.length === 0) {
          return res.status(404).json({ error: 'Flight not found' });
      }

      const flight = flights[0];

      // Get numTravelers and avgWeight
      connection.query(statsQuery, [flightId], (err2, stats) => {
          if (err2) {
              return res.status(500).json({ error: 'Stats query error' });
          }

          const { numTravelers, avgWeight } = stats[0];

          res.json({
              flightId: flight.flight_id,
              totalCapacity: flight.total_capacity,
              remainingCapacity: flight.remaining_capacity,
              usedCapacity: flight.total_capacity - flight.remaining_capacity,
              numTravelers,
              avgWeight: avgWeight !== null ? parseFloat(avgWeight).toFixed(2) : "0.00"
          });
      });
  });
});

app.get('/api/flight/:flightId/check-ins', (req, res) => {
    const { flightId } = req.params;

    const query = `
        SELECT c.*, p.passenger_name 
        FROM cargo_checkins c
        LEFT JOIN passengers p ON c.passenger_id = p.passenger_id
        WHERE c.flight_id = ?
    `;

    connection.query(query, [flightId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});