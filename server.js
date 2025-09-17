import express from "express";
import ejs from "ejs";
import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import pkg from 'number-to-words';

const { toWords } = pkg;

dotenv.config();

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

app.set("view engine", "ejs");
app.set("views", "./views");

// ------------------ ROUTES ------------------

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "views/form.html"));
});

app.post("/api/receipts", async (req, res) => {
  try {
    const { customer_name, customer_phone, items, paid_amount, unpaid_amount, payment_method, invoice_no } = req.body;
    const itemsParsed = typeof items === "string" ? JSON.parse(items) : items;
    const subtotal = itemsParsed.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
    const total = subtotal;

    // Amount in words (for paid only if unpaid exists)
    const total_for_words = unpaid_amount > 0 ? paid_amount : total;
    const amount_in_words = toWords(total_for_words).charAt(0).toUpperCase() + toWords(total_for_words).slice(1) + " naira only";

    const { data, error } = await supabase.from("receipts").insert([{
      customer_name,
      customer_phone,
      items: itemsParsed,
      subtotal,
      total,
      paid_amount,
      unpaid_amount,
      payment_method,
      invoice_no,
      amount_in_words
    }]).select().single();

    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true, invoice_no: data.invoice_no });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

app.get("/receipt/:invoice_no", async (req, res) => {
  try {
    const { data: invoice, error } = await supabase.from("receipts").select("*").eq("invoice_no", req.params.invoice_no).single();
    if (error || !invoice) return res.status(404).send("Invoice not found");

    const logoPath = path.join(process.cwd(), "public/logo.jpg");
    const logoDataUri = fs.readFileSync(logoPath).toString("base64");

    const signaturePath = path.join(process.cwd(), "public/signature.png"); // make sure this exists
    const signatureDataUri = fs.readFileSync(signaturePath).toString("base64");


    const html = await ejs.renderFile("views/receipt.ejs", { invoice, logoDataUri , signatureDataUri});

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" } });
    await browser.close();

    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename=receipt-${invoice.invoice_no}.pdf` });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating PDF");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
