// Import necessary modules
import { Router } from "express";  // Express router to define API routes
import fs from "fs";               // (Currently unused) File system module for potential future persistence

const settingsRouter = Router();   // Create a new router instance

// In-memory object to store current settings temporarily during server runtime
let inMemorySettings: any = {}; 

// Route to receive and store settings from client
settingsRouter.post("/settings", (req, res) => {
  inMemorySettings = req.body;  // Store received settings in memory
  console.log("Settings received and stored:", inMemorySettings); // Log for debugging
  res.json({ message: "Settings updated" });  // Respond with success message
});

// Route to return current settings to client
settingsRouter.get("/settings", (req, res) => {
  res.json(inMemorySettings);  // Send back current in-memory settings
});

// Export router so it can be mounted in the main server file
export default settingsRouter;
