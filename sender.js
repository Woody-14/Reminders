const fs = require("fs");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const tasks = JSON.parse(fs.readFileSync("tasks.json", "utf8"));
const now = new Date();

// Helper: get difference in days
const daysSince = (date) => {
  if (!date) return Infinity;
  const diff = now - new Date(date);
  return diff / (1000 * 60 * 60 * 24);
};

// Frequency thresholds (in days)
const frequencyDays = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semiannual: 182,
  annual: 365
};

// Filter tasks that are due now
const dueTasks = tasks.filter(task => {
  if (task.type === "one-time") return true;
  const limit = frequencyDays[task.frequency];
  return daysSince(task.lastSent) >= limit;
});

if (dueTasks.length === 0) {
  console.log("No tasks are due this week. Skipping email.");
  process.exit(0);
}

// Build email
const taskListHtml = dueTasks.map(task => `<li>${task.task}</li>`).join("");

const msg = {
  to: process.env.TO_EMAIL,
  from: process.env.FROM_EMAIL,
  subject: "Your Task Reminder 🧾",
  html: `
    <h2>Tasks due this period:</h2>
    <ul>${taskListHtml}</ul>
    <p>Keep it up! 🧹</p>
  `
};

// Send email
sgMail
  .send(msg)
  .then(() => {
    console.log("Task email sent!");

    // Update lastSent for recurring tasks
    dueTasks.forEach(dueTask => {
      const taskIndex = tasks.findIndex(t => t.task === dueTask.task);
      if (tasks[taskIndex].type === "recurring") {
        tasks[taskIndex].lastSent = now.toISOString();
      }
    });

    // Remove one-time tasks
    const updatedTasks = tasks.filter(t => t.type !== "one-time");

    fs.writeFileSync("tasks.json", JSON.stringify(updatedTasks, null, 2));
    console.log("tasks.json updated.");
  })
  .catch(err => console.error("Error sending email:", err));
