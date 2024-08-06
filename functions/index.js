/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// https://cloud.google.com/functions/docs/writing/write-http-functions#handling_cors_requests

const {initializeApp} = require("firebase-admin/app");
const {onRequest} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");
const {debug} = require("firebase-functions/logger");

initializeApp();

exports.addContact = onRequest(
    {cors: ["https://imageonsd.com", "https://dev.imageonsd.com", "https://staging.imageonsd.com", "http://localhost:8080"]},
    async (request, response) => {
      debug("log add contact - 99", request.body);
      const {name, email, phone, details} = request.body;

      let writeResult = null;

      if (!email) {
        response.status(400).json({error: "Missing required fields"});
      } else {
        writeResult = await getFirestore()
            .collection("contacts")
            .add({
              to: "imageonprintingservice@gmail.com, admin@imageonsd.com",
              message: {
                subject: `Lead from Site: ${name}`,
                body: `Name: ${name}\n
                  Phone: ${phone}\n
                  Details: ${details}\n
                  Email: ${email}`,
                html: `<p>Name: ${name}</p><br>
                  <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                  <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                  <p>Details: ${details}</p>`,
              },
            });
        response.json({result: `Message written with ID: ${writeResult.id}`});
      }
    });


exports.addPPDContact = onRequest(
    {cors: ["http://localhost:8080", "https://pepperfarmdeli.com"]},
    async (request, response) => {
      debug("log add contact - 79", request.body);
      const {name, email, phone, question} = request.body;

      const writeResult = await getFirestore()
          .collection("contacts")
          .add({
            to: "pepperfarmdeli@gmail.com",
            message: {
              subject: `Question from: ${name}`,
              body: `Name: ${name}\n
                Phone: ${phone}\n
                Email: ${email}\n
                Question: ${question}`,
              html: `<p>Name: ${name}</p><br>
                <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                <p>Question: ${question}</p>`,
            },
          });
      response.json({result: `Message written with ID: ${writeResult.id}`});
    });


exports.addPPDCateringContact = onRequest(
    {cors: ["http://localhost:8080", "https://pepperfarmdeli.com"]},
    async (request, response) => {
      debug("log add catering - 69", request.body);
      const {
        name,
        email,
        phone,
        eventDate,
        guests,
        eventType,
        pickup,
        location,
        comments,
      } = request.body;

      const writeResult = await getFirestore()
          .collection("contacts")
          .add({
            to: "pepperfarmdeli@gmail.com",
            message: {
              subject: `Catering Inquiry from: ${name}`,
              body: `Name: ${name}\n
                Phone: ${phone}\n
                Email: ${email}\n
                Event Date: ${eventDate}\n
                Guests: ${guests}\n
                Event Type: ${eventType}\n
                Pickup: ${pickup}\n
                Location: ${location}\n
                Comments: ${comments}`,
              html: `<p>Name: ${name}</p><br>
                <p>Email: <a href="mailto:${email}">${email}</a></p><br>
                <p>Phone: <a href="tel:${phone}">${phone}</a></p><br>
                <p>Event Date: ${eventDate}</p><br>
                <p>Guests: ${guests}</p><br>
                <p>Event Type: ${eventType}</p><br>
                <p>Pickup: ${pickup}</p><br>
                <p>Location: ${location}</p><br>
                <p>Comments: ${comments}</p>`,
            },
          });
      response.json({result: `Message written with ID: ${writeResult.id}`});
    });
