// Importing required modules
import express from 'express';                        // Express framework for building the HTTP server
import http from 'http';                              // Node's HTTP module to create server
import { setupWebSocketServer } from './transcription/websocket/connection'; // Custom WebSocket setup logic
import settingsRouter from "./web/routes/settings";   // Router for settings-related HTTP endpoints
import dotenv from 'dotenv';                          // To load environment variables from .env file
import cors from 'cors';                              // Middleware to enable Cross-Origin Resource Sharing
import saveQuestionsRouter from "./web/routes/save_questions"; // Router to handle saving generated questions

// Load environment variables from .env file
dotenv.config();

// Initialize the Express application
const app = express();

// Create an HTTP server instance using the Express app
const server = http.createServer(app);

// Apply middlewares
app.use(cors());               // Enable CORS to allow frontend to communicate with backend across domains
app.use(express.json());       // Middleware to parse incoming JSON requests

// Route definitions
app.use("/settings", settingsRouter);       // Mount settings-related routes at /settings
app.use("/questions", saveQuestionsRouter); // Mount question-saving routes at /questions

// Health check route
app.get('/', (_req, res) => {
  res.send('PollGen Backend is running.');  // Simple response to confirm the server is alive
});

// Initialize WebSocket server for real-time transcription handling
setupWebSocketServer(server);

// Define port and start the HTTP server
const PORT = process.env.PORT || 3000;      // Use environment port or default to 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`); // Log the server URL
});
