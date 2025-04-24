# Cargo Management System

A comprehensive Database Management System (DBMS) project for managing cargo and flight operations, built with Node.js, Express, and MySQL.

## Table of Contents
- [Database Overview](#database-overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Database Operations](#database-operations)
- [Security](#security)
- [Running the Application](#running-the-application)

## Database Overview

This project implements a robust MySQL-based database system for managing:
- Flight information and capacity tracking
- Cargo check-ins and weight management
- User authentication and authorization
- Dynamic pricing calculations
- Real-time capacity monitoring

## Features

- **Database Management**
  - MySQL relational database implementation
  - Optimized table structures and relationships
  - Efficient query execution and indexing
  - Transaction management for data integrity
  - Stored procedures for complex operations

- **Flight Operations**
  - Flight initialization and capacity management
  - Real-time capacity tracking using SQL triggers
  - Automated capacity updates
  - Historical flight data management

- **Cargo Management**
  - Cargo check-in system with dynamic pricing
  - Weight tracking and validation
  - Automated price calculations
  - Capacity utilization monitoring

## Prerequisites

- MySQL Server (v8.0 or higher)
- MySQL Workbench or similar database management tool
- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd cargo-management-system
```

2. Install dependencies:
```bash
npm install
```

## Database Setup

1. Create the MySQL database:
```sql
CREATE DATABASE cargo_db;
USE cargo_db;
```

2. Create the required tables:
```sql
-- Flights Table
CREATE TABLE flights (
    flight_id VARCHAR(50) PRIMARY KEY,
    total_capacity INT NOT NULL,
    remaining_capacity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cargo Check-ins Table
CREATE TABLE cargo_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    flight_id VARCHAR(50),
    passenger_id VARCHAR(50),
    weight INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
);

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

3. Create indexes for better performance:
```sql
CREATE INDEX idx_flight_id ON cargo_checkins(flight_id);
CREATE INDEX idx_passenger_id ON cargo_checkins(passenger_id);
CREATE INDEX idx_created_at ON flights(created_at);
```

## Configuration

Create a `.env` file in the root directory with the following variables:
```
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=cargo_db
JWT_SECRET=your_jwt_secret
```

## Database Operations

### Key SQL Queries

1. **Flight Initialization**
```sql
INSERT INTO flights (flight_id, total_capacity, remaining_capacity) 
VALUES (?, ?, ?);
```

2. **Cargo Check-in**
```sql
-- Check available capacity
SELECT remaining_capacity FROM flights WHERE flight_id = ?;

-- Update flight capacity
UPDATE flights SET remaining_capacity = ? WHERE flight_id = ?;

-- Record check-in
INSERT INTO cargo_checkins (flight_id, passenger_id, weight, price) 
VALUES (?, ?, ?, ?);
```

3. **Flight Status**
```sql
SELECT 
    f.flight_id,
    f.total_capacity,
    f.remaining_capacity,
    COUNT(c.id) as num_checkins,
    AVG(c.weight) as avg_weight
FROM flights f
LEFT JOIN cargo_checkins c ON f.flight_id = c.flight_id
WHERE f.flight_id = ?
GROUP BY f.flight_id;
```

## Database Schema

### Flights Table
- `flight_id` (VARCHAR(50)): Primary key
- `total_capacity` (INT): Total cargo capacity in kg
- `remaining_capacity` (INT): Available cargo capacity
- `created_at` (TIMESTAMP): Flight creation timestamp

### Cargo Check-ins Table
- `id` (INT): Auto-incrementing primary key
- `flight_id` (VARCHAR(50)): Foreign key to flights
- `passenger_id` (VARCHAR(50)): Passenger identifier
- `weight` (INT): Cargo weight in kg
- `price` (DECIMAL(10,2)): Calculated price
- `created_at` (TIMESTAMP): Check-in timestamp

### Users Table
- `id` (INT): Auto-incrementing primary key
- `username` (VARCHAR(50)): Unique username
- `password` (VARCHAR(255)): Hashed password
- `role` (VARCHAR(20)): User role
- `created_at` (TIMESTAMP): User creation timestamp

## Security

- **Database Security**
  - Prepared statements to prevent SQL injection
  - Password hashing using bcrypt
  - Role-based access control
  - Secure connection using environment variables
  - Regular database backups

- **Application Security**
  - JWT-based authentication
  - Protected routes for sensitive operations
  - CORS enabled for cross-origin requests
  - Environment variables for sensitive data

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Start the production server:
```bash
npm start
```

The application will be available at `http://localhost:3000`


# Installation

you can try this code by yourself:
- clone this repo and change the lines (10-13) in server.js to the details of your MySQL details.
- run the command ```npm install``` to install required packages.
- next run the command ```node server.js```, and open localhost:3000 in your browser.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

