import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      company,
      email,
      phone,
      message,
    } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        {
          error:
            "Name, email and message are required.",
        },
        { status: 400 }
      );
    }

    const { error } = await resend.emails.send({
      from: "DRIVEGRID <onboarding@resend.dev>",
      to: ["hunter.bing.dai@gmail.com"],
      replyTo: email,
      subject: `New DRIVEGRID Partner Inquiry — ${company || name}`,
      text: `
New DRIVEGRID Partner Inquiry

Name: ${name}
Company: ${company || "Not provided"}
Email: ${email}
Phone: ${phone || "Not provided"}

Message:
${message}
      `,
    });

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: "Failed to send email." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}