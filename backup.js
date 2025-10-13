const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const axios = require("axios");

const { Users, Portfolio } = require("./database");

const app = express();

app.use([
  cors({
    // origin: "https://fencing-prod.vercel.app",
    origin: "http://localhost:5174",
    // origin: "http://localhost:5173",
  }),
  express.static("public"),
]);
app.use(bodyParser.json());

app.post("/user", async function (req, res) {
  try {
    const data = req.body;
    const newRecord = new Users(data);
    const idString = newRecord._id.toString();
    newRecord.save();
    res.status(200).json({
      data: idString,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
    });
  }
});

app.post("/portfolio", async function (req, res) {
  try {
    const { portfolioLink, associatedTo } = req.body;
    const data = {
      portfolioLink: portfolioLink,
      associatedTo: associatedTo,
    };
    const newRecord = new Portfolio(data);
    newRecord.save();
    res.status(200).json({
      data: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
    });
  }
});

app.post("/save-feedback", async (req, res) => {
  try {
    const { portfolioLink, associatedTo, x, y, feedback } = req.body;

    if (!portfolioLink || !feedback) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const data = {
      portfolioLink,
      associatedTo,
      x,
      y,
      feedback,
    };
    const newRecord = new Portfolio(data);
    await newRecord.save();
    res.json({ success: true, message: "Feedback saved!" });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

async function getFeedbacks(portfolioLink, userId) {
  const feedbacks = await Portfolio.find({
    portfolioLink: portfolioLink,
    associatedTo: userId,
  });
  return feedbacks;
}

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  const userId = req.query.userId;

  if (!targetUrl) {
    return res.status(400).send("Missing ?url parameter");
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: "text",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const contentType = response.headers["content-type"] || "text/html";
    res.setHeader("Content-Type", contentType);

    // 🛑 Remove headers that block iframing
    res.removeHeader("x-frame-options");
    res.removeHeader("content-security-policy");

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(targetUrl);
      const encodedUserId = encodeURIComponent(userId || "Anonymous");

      // Fetch existing feedbacks
      let existingFeedbacks = [];
      try {
        existingFeedbacks = await getFeedbacks(targetUrl, userId);
      } catch (err) {
        console.error("Error fetching feedbacks:", err);
      }

      // Helper to rewrite URLs
      const rewriteUrl = (url) => {
        if (!url) return url;
        if (url.startsWith("http") || url.startsWith("mailto"))
          return `/proxy?url=${encodeURIComponent(
            url
          )}&userId=${encodedUserId}`;
        return `/proxy?url=${encodeURIComponent(
          new URL(url, baseUrl).toString()
        )}&userId=${encodedUserId}`;
      };

      // Fix links
      $("a").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });

      // Fix scripts, styles, images, iframes
      $("script").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("link").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });
      $("img").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("iframe").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });

      const commentScript = `
        window.commentMode = false;
        window.comments = [];
        window.userId = "${userId || "Anonymous"}";

        window.addEventListener("message", (event) => {
          if (event.data?.type === "toggleCommentMode") {
            window.commentMode = event.data.mode;
          }
        });
        function createCommentCard(x, y) {
          // Remove any existing input commentCard
          const existing = document.getElementById('comment-card');
          if (existing) existing.remove();

          // Create commentCard container
          const commentCard = document.createElement('div');
          commentCard.id = 'comment-card';
          commentCard.style.position = 'absolute';
          commentCard.style.left = x + 'px';
          commentCard.style.top = y + 'px';
          commentCard.style.background = 'white';
          commentCard.style.width = '300px';
          commentCard.style.height='max-content';
          commentCard.style.display='flex';
          commentCard.style.flexDirection='column';
          commentCard.style.border='2px solid #EBEFF4';
          commentCard.style.borderRadius = '12px';
          commentCard.style.padding = '12px';
          commentCard.style.gap='8px';
          commentCard.style.zIndex='100000';

          const commentHeader = document.createElement('div');
          commentHeader.style.width = '100%';
          commentHeader.style.display = 'flex';

          const commentTitle = document.createElement('div');
          commentTitle.textContent = 'Comment';
          commentTitle.style.fontWeight = '600';

          commentHeader.appendChild(commentTitle);
          commentCard.appendChild(commentHeader);

          const commentBody = document.createElement('div');
          commentBody.style.width = '100%';
          commentBody.style.flexGrow = '1';
          commentBody.style.border = '2px solid #EBEFF4';
          commentBody.style.borderRadius = '12px';
          commentBody.style.backgroundColor = '#F9FAFB';
          commentBody.style.padding = '12px';
          commentBody.style.textAlign ='justify';

          // Input element
          const input = document.createElement('textarea');
          input.placeholder = 'Enter comment...';
          input.id = "comment"
          input.rows = 4;
          input.style.width = '100%';
          input.style.height = '100%';
          input.style.outlineWidth = '0px';
          input.style.backgroundColor = '#F9FAFB';
          input.style.border = '0px';

          commentBody.appendChild(input);
          commentCard.appendChild(commentBody);


          // Footer
          const commentFooter = document.createElement('div');
          commentFooter.style.display= 'flex';
          commentFooter.style.gap = '8px';

          const submitButton = document.createElement('button');
          submitButton.textContent = 'Submit';
          submitButton.style.width='max-content';
          submitButton.style.height = 'max-content';
          submitButton.style.padding ='4px 12px';
          submitButton.style.borderRadius = '4px';
          submitButton.style.backgroundColor='#3a3cff';
          submitButton.style.color = 'white';
          submitButton.style.fontSize='14px';
          submitButton.style.border='1px solid transparent';

          commentCard.appendChild(commentFooter);



          submitButton.onclick = () => {
            const text = input.value.trim();
            if (!text) return;

            const portfolioLink = decodeURIComponent(
              new URLSearchParams(window.location.search).get("url")
            );

            window.comments.push({ x, y, text });

            axios.post('/save-feedback', {
                    portfolioLink,
                    associatedTo:  window.userId,
                    x,
                    y,
                    feedback: text
              })
              .then(res => console.log("✅ Feedback saved:", res.data))
              .catch(err => console.error("❌ Error saving feedback:", err));


            // Create pin image
            const pin = document.createElement('img');
            pin.src = 'http://localhost:5174/pin.png'; // 
            pin.style.position = 'absolute';
            pin.style.left = x + 'px';
            pin.style.top = y + 'px';
            pin.style.width = '40px';
            pin.style.height = '40px';
            pin.style.cursor = 'pointer';
            pin.style.zIndex = 9999;


            const feedbackCard = document.createElement('div');
            feedbackCard.style.position = 'absolute';
            feedbackCard.style.left = x + 'px';
            feedbackCard.style.top = y + 50 + 'px';
            feedbackCard.style.background = 'white';
            feedbackCard.style.border = '2px solid #EBEFF4';
            feedbackCard.style.borderRadius = '12px';
            feedbackCard.style.padding = '12px';
            feedbackCard.style.width = '300px';
            feedbackCard.style.height = 'max';
            feedbackCard.style.zIndex = 10000;
            feedbackCard.style.display = 'none'; // initially hidden
            feedbackCard.style.flexDirection = 'column';
            feedbackCard.style.gap = '8px';


            const feedbackHeader = document.createElement('div');
            feedbackHeader.style.width = '100%';
            feedbackHeader.style.display = 'flex';
            feedbackHeader.style.justifyContent = 'space-between'

            const feedbackTitle = document.createElement('div');
            feedbackTitle.textContent = 'Feedback';
            feedbackTitle.style.fontWeight = '600';

            const closeImg = document.createElement('img');
              closeImg.src = 'http://localhost:5174/cross.png'
              closeImg.style.width = '20px';
              closeImg.style.height = '20px';
              closeImg.style.cursor = 'pointer';
              closeImg.onclick = () => {
              feedbackCard.style.display = 'none';
            };

            feedbackHeader.appendChild(feedbackTitle);
            feedbackHeader.appendChild(closeImg);

            const feedbackBody = document.createElement('div');
            feedbackBody.style.width = '100%';
            feedbackBody.style.flexGrow = '1';
            feedbackBody.style.border = '2px solid #EBEFF4';
            feedbackBody.style.borderRadius = '12px';
            feedbackBody.style.backgroundColor = '#F9FAFB';
            feedbackBody.style.padding = '12px';
            feedbackBody.style.textAlign ='justify';

            const content = document.createElement('div');
            content.textContent = text;

            feedbackBody.appendChild(content);


            feedbackCard.appendChild(feedbackHeader);
            feedbackCard.appendChild(feedbackBody);

            // Toggle tooltip on pin click
            pin.onclick = (e) => {
              e.stopPropagation();
              feedbackCard.style.display = feedbackCard.style.display === 'none' ? 'flex' : 'none';
            };

            // Append pin + tooltip
            document.body.appendChild(pin);
            document.body.appendChild(feedbackCard);

            // Save comment data
            window.comments.push({ x, y, text });

            // Remove input commentCard after submit
            commentCard.remove();
          };

          commentFooter.appendChild(submitButton);

          const cancelButton = document.createElement('button');
          cancelButton.textContent = 'Cancel';
          cancelButton.style.width='max-content';
          cancelButton.style.height = 'max-content';
          cancelButton.style.padding ='4px 12px';
          cancelButton.style.borderRadius = '4px';
          cancelButton.style.fontSize='14px';
          cancelButton.style.border='1px solid #EBEFF4';
          cancelButton.onclick = () => commentCard.remove();

          commentFooter.appendChild(cancelButton);
          document.body.appendChild(commentCard);
          input.focus();
        }

        //diff logic+
        ['click', 'mousedown', 'mouseup'].forEach(eventType => {
        document.addEventListener(
          eventType,
          function(e) {
            if (!window.commentMode) return;
            if (e.target.closest('#comment-card')) return;

            // Stop everything
            e.preventDefault();
            e.stopPropagation();

            // Only create comment on the initial click
            if (eventType === 'click') {
              const x = e.pageX;
              const y = e.pageY;
              createCommentCard(x, y);
            }
          },
          { capture: true } // important: intercept events in capturing phase
        );
      });
      `;

      const initialFeedbackLoadingScript = `
  const existingFeedbacks = ${JSON.stringify(existingFeedbacks)};
  console.log(existingFeedbacks);

  existingFeedbacks.forEach(f => {
      const pin = document.createElement('img');
      pin.src = 'http://localhost:5174/pin.png'; // 
      pin.style.position = 'absolute';
      pin.style.left = f.x + 'px';
      pin.style.top = f.y + 'px';
      pin.style.width = '40px';
      pin.style.height = '40px';
      pin.style.cursor = 'pointer';
      pin.style.zIndex = 9999;

      const feedbackCard = document.createElement('div');
      feedbackCard.style.position = 'absolute';
      feedbackCard.style.left = f.x + 'px';
      feedbackCard.style.top = (f.y + 50) + 'px';
      feedbackCard.style.background = 'white';
      feedbackCard.style.border = '2px solid #EBEFF4';
      feedbackCard.style.borderRadius = '12px';
      feedbackCard.style.padding = '12px';
      feedbackCard.style.width = '300px';
      feedbackCard.style.height = 'max';
      feedbackCard.style.zIndex = 10000;
      feedbackCard.style.display = 'none'; // initially hidden
      feedbackCard.style.flexDirection = 'column';
      feedbackCard.style.gap = '8px';


      const feedbackHeader = document.createElement('div');
      feedbackHeader.style.width = '100%';
      feedbackHeader.style.display = 'flex';
      feedbackHeader.style.justifyContent = 'space-between'

      const feedbackTitle = document.createElement('div');
      feedbackTitle.textContent = 'Feedback';
      feedbackTitle.style.fontWeight = '600';

      const closeImg = document.createElement('img');
      closeImg.src = 'http://localhost:5174/cross.png'
      closeImg.style.width = '20px';
      closeImg.style.height = '20px';
      closeImg.style.cursor = 'pointer';
      closeImg.onclick = () => {
      feedbackCard.style.display = 'none';};

      feedbackHeader.appendChild(feedbackTitle);
      feedbackHeader.appendChild(closeImg);

      const feedbackBody = document.createElement('div');
      feedbackBody.style.width = '100%';
      feedbackBody.style.flexGrow = '1';
      feedbackBody.style.border = '2px solid #EBEFF4';
      feedbackBody.style.borderRadius = '12px';
      feedbackBody.style.backgroundColor = '#F9FAFB';
      feedbackBody.style.padding = '12px';
      feedbackBody.style.textAlign ='justify';

      const content = document.createElement('div');
      content.textContent = f.feedback;

      feedbackBody.appendChild(content);


      feedbackCard.appendChild(feedbackHeader);
      feedbackCard.appendChild(feedbackBody);

      // // Toggle tooltip on pin click
      pin.onclick = (e) => {
        e.stopPropagation();
        console.log("helllllllllll")
        feedbackCard.style.display = 'flex';
      };

      // Append pin + tooltip
      document.body.appendChild(pin);
      document.body.appendChild(feedbackCard);
  });
`;
      $("body").append(
        `<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>`
      );
      $("body").append(`<script>${commentScript}<\/script>`);
      $("body").append(`<script>${initialFeedbackLoadingScript}<\/script>`);

      res.send($.html());
    } else {
      // Non-HTML (e.g. images, CSS, fonts)
      res.send(response.data);
    }
  } catch (error) {
    res.status(500).send("Error fetching target URL: " + error.message);
  }
});

app.get("/user/:id", async function (req, res) {
  try {
    const userId = req.params.id;
    const user = await Users.findById(userId);
    res.status(200).json({
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      data: err,
    });
  }
});

// #############################################################

// app.get("/checkout", async function (req, res) {
//   try {
//     const students = await Students.find({});
//     if (students.length > 0) {
//       const historyRecords = students.map((student) => ({
//         id: student.studentId,
//         name: student.name,
//         points: student.points,
//         status: "Out",
//         group: student.group,
//         dateTime: new Date().toISOString(),
//         change: "Status",
//       }));

//       await History.insertMany(historyRecords);
//       await Students.updateMany({}, { $set: { status: "Out" } });
//     }
//     res.status(200).json({
//       data: "",
//     });
//   } catch (err) {
//     res.status(500).json({
//       data: err,
//     });
//   }
// });

// app.put("/student/:id", async function (req, res) {
//   try {
//     const studentId = req.params.id;
//     const data = req.body;
//     await Students.updateOne({ id: studentId }, { $set: data });
//     res.status(200).json({
//       data: null,
//     });
//   } catch (err) {
//     res.status(500).json({
//       data: err,
//     });
//   }
// });

// app.post("/history", async function (req, res) {
//   try {
//     const data = req.body;
//     const newRecord = new History(data);
//     newRecord.save();
//     res.status(200).json({
//       data: null,
//     });
//   } catch (err) {
//     res.status(500).json({
//       data: null,
//     });
//   }
// });

// app.get("/history/:id", async function (req, res) {
//   try {
//     const id = req.params.id;
//     const students = await History.find({ "id": id });
//     res.status(200).json({
//       data: students,
//     });
//   } catch (err) {
//     res.status(500).json({
//       data: err,
//     });
//   }
// });

app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
