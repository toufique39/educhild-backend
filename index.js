
import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { verifyToken } from "./middleware/verifyToken.js";

export const app = express();

const PORT =  3000;

// Environment variables
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "edu_child";


if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables.");
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
});

// Database
const db = client.db(MONGO_DB);

// Collection
const upcommingCollection = db.collection("upcomming-events");
const joinedEventsCollection = db.collection("joined-events");

// Middleware
const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:10000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json());




app.get("/", (req, res) => {
  res.send("Welcome to EduChild API!");
});





app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EduChild API is running successfully!",
  });
});




app.get("/api/health/db", async (req, res) => {
  try {
    const result = await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "MongoDB connection is working",
      database: db.databaseName,
      ping: result.ok,
    });
  } catch (error) {
    console.error("Database health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});




app.get("/upcomming-events", async (req, res) => {
  try {
    const currentDate = new Date();
    const limit = req.query.limit
      ? Number(req.query.limit)
      : null;

    // Validate limit
    if (
      limit !== null &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }
    const pipeline = [
      {
        $addFields: {
          _eventDate: {
            $convert: {
              input: "$eventDate",
              to: "date",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $match: {
          _eventDate: {
            $gt: currentDate,
          },
        },
      },
      {
        $sort: {
          _eventDate: 1,
        },
      },
    ];

    if (limit !== null) {
      pipeline.push({
        $limit: limit,
      });
    }

   
    pipeline.push(
      {
        $set: {
          eventDate: "$_eventDate",
        },
      },
      {
        $unset: "_eventDate",
      }
    );

    
    const events = await upcommingCollection
      .aggregate(pipeline)
      .toArray();

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });

  } catch (error) {
    console.error("Upcoming events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming events",
    });
  }
});

// Create a new event (Protected Route)
app.post("/upcomming-events", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      thumbnailUrl,
      location,
      eventDate,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !description?.trim() ||
      !eventType ||
      !thumbnailUrl ||
      !location?.area?.trim() ||
      !location?.city?.trim() ||
      !eventDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required event information.",
      });
    }

    // Validate thumbnail URL
    let imageUrl;

    try {
      imageUrl = new URL(thumbnailUrl);

      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        throw new Error("Invalid image URL");
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid thumbnail URL.",
      });
    }

    // Validate event date
    const parsedEventDate = new Date(eventDate);

    if (
      Number.isNaN(parsedEventDate.getTime()) ||
      parsedEventDate.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future.",
      });
    }

    // Create event document
    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType,
      thumbnailUrl: imageUrl.href,

      location: {
        area: location.area.trim(),
        city: location.city.trim(),
      },

      eventDate: parsedEventDate,

      // Creator information comes from verified JWT
      creatorEmail: req.user.email,
      creatorId: req.user.id,
      creatorName: req.user.name,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to MongoDB
    const result = await upcommingCollection.insertOne(newEvent);

    return res.status(201).json({
      success: true,
      message: "Event created successfully.",
      data: {
        ...newEvent,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("Event creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create event.",
    });
  }
});

// Get events created by the authenticated user
app.get("/my-events", verifyToken, async (req, res) => {
  try {
    const events = await upcommingCollection
      .find({
        $or: [
          { creatorId: req.user.id },
          { creatorEmail: req.user.email },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Fetch my events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your events.",
    });
  }
});


// Update an event (Protected Route)
app.patch("/upcomming-events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // Only update events belonging to the authenticated user
    const filter = {
      _id: new ObjectId(id),
      $or: [
        { creatorId: req.user.id },
        { creatorEmail: req.user.email },
      ],
    };

    const {
      title,
      description,
      eventType,
      thumbnailUrl,
      location,
      eventDate,
    } = req.body;

    const updates = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Event title is required.",
        });
      }

      updates.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({
          success: false,
          message: "Event description is required.",
        });
      }

      updates.description = description.trim();
    }

    if (eventType !== undefined) {
      if (typeof eventType !== "string" || !eventType.trim()) {
        return res.status(400).json({
          success: false,
          message: "Event type is required.",
        });
      }

      updates.eventType = eventType;
    }

    if (thumbnailUrl !== undefined) {
      try {
        const imageUrl = new URL(thumbnailUrl);

        if (!["http:", "https:"].includes(imageUrl.protocol)) {
          throw new Error("Invalid image URL");
        }

        updates.thumbnailUrl = imageUrl.href;
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid thumbnail URL.",
        });
      }
    }

    if (location !== undefined) {
      if (
        typeof location.area !== "string" ||
        !location.area.trim() ||
        typeof location.city !== "string" ||
        !location.city.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid area and city are required.",
        });
      }

      updates.location = {
        area: location.area.trim(),
        city: location.city.trim(),
      };
    }

    if (eventDate !== undefined) {
      const parsedDate = new Date(eventDate);

      if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message: "Event date must be in the future.",
        });
      }

      updates.eventDate = parsedDate;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid update information provided.",
      });
    }

    updates.updatedAt = new Date();

    const result = await upcommingCollection.updateOne(
      filter,
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found or you are not authorized to update it.",
      });
    }

    const updatedEvent = await upcommingCollection.findOne(filter);

    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update event.",
    });
  }
});


// Get events joined by the authenticated user
app.get("/joined-events", verifyToken, async (req, res) => {
  try {
    const joinedEvents = await joinedEventsCollection
      .aggregate([
        // Get only current user's registrations
        {
          $match: {
            userId: req.user.id,
          },
        },

        // Join with original events collection
        {
          $lookup: {
            from: "upcomming-events",
            localField: "eventId",
            foreignField: "_id",
            as: "event",
          },
        },

        // Flatten joined event
        {
          $unwind: "$event",
        },

        // Normalize event date for sorting
        {
          $addFields: {
            sortEventDate: {
              $convert: {
                input: "$event.eventDate",
                to: "date",
                onError: null,
                onNull: null,
              },
            },
          },
        },

        // Sort by event date ascending
        {
          $sort: {
            sortEventDate: 1,
          },
        },

        // Return required event information
        {
          $project: {
            _id: "$event._id",
            title: "$event.title",
            description: "$event.description",
            eventType: "$event.eventType",
            thumbnailUrl: "$event.thumbnailUrl",
            location: "$event.location",
            eventDate: "$event.eventDate",
            creatorEmail: "$event.creatorEmail",
            joinedAt: 1,
          },
        },
      ])
      .toArray();

    return res.status(200).json({
      success: true,
      count: joinedEvents.length,
      data: joinedEvents,
    });
  } catch (error) {
    console.error("Fetch joined events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch joined events.",
    });
  }
});



// Delete an event (Protected Route)
app.delete("/upcomming-events/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    const result = await upcommingCollection.deleteOne({
      _id: new ObjectId(id),
      $or: [
        { creatorId: req.user.id },
        { creatorEmail: req.user.email },
      ],
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found or you are not authorized to delete it.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete event.",
    });
  }
});




app.get("/upcomming-events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    
    const event = await upcommingCollection.findOne({
      _id: new ObjectId(id),
    });

    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const normalizedEvent = {
      ...event,
      eventDate: event.eventDate
        ? new Date(event.eventDate)
        : null,
    };

    res.status(200).json({
      success: true,
      data: normalizedEvent,
    });

  } catch (error) {
    console.error("Single event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch event",
    });
  }
});

// Join an event (Protected Route)
app.post(
  "/upcomming-events/:id/join",
  verifyToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Validate event ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
      }

      const eventId = new ObjectId(id);

      // Check whether event exists
      const event = await upcommingCollection.findOne({
        _id: eventId,
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      // Only allow joining future events
      const eventDate = new Date(event.eventDate);

      if (
        Number.isNaN(eventDate.getTime()) ||
        eventDate.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message: "This event is no longer available for joining.",
        });
      }

      // Check existing registration
      const existingJoin = await joinedEventsCollection.findOne({
        eventId,
        userId: req.user.id,
      });

      if (existingJoin) {
        return res.status(409).json({
          success: false,
          message: "You have already joined this event.",
        });
      }

      // Save joined event information
      const joinedEvent = {
        eventId,
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        joinedAt: new Date(),
      };

      await joinedEventsCollection.insertOne(joinedEvent);

      return res.status(201).json({
        success: true,
        message: "You have successfully joined the event.",
      });
    } catch (error) {
      // Handle duplicate registration safely
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "You have already joined this event.",
        });
      }

      console.error("Join event error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to join event.",
      });
    }
  }
);



// Reusable MongoDB connection for Netlify Functions
let connectionPromise = null;

export async function connectDatabase() {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      console.log("Connecting to MongoDB...");

      await client.connect();

      console.log("MongoDB connected successfully!");

      await joinedEventsCollection.createIndex(
        {
          eventId: 1,
          userId: 1,
        },
        {
          unique: true,
        }
      );

      console.log("Joined-events index ready.");
    })().catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}
