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

    // Send inquiry notification to DRIVEGRID
    const { error: ownerError } =
      await resend.emails.send({
        from: "DRIVEGRID <partners@drive-grid.com>",
        to: ["hunter.bing.dai@gmail.com"],
        replyTo: email,
        subject: `New DRIVEGRID Partner Inquiry — ${
          company || name
        }`,
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

    if (ownerError) {
      console.error(ownerError);

      return NextResponse.json(
        {
          error:
            "Failed to send inquiry notification.",
        },
        { status: 500 }
      );
    }

    // Send confirmation email to the person
    // who submitted the inquiry
    const { error: confirmationError } =
      await resend.emails.send({
        from: "DRIVEGRID <partners@drive-grid.com>",
        to: [email],
        subject:
          "Thank You for Contacting DRIVEGRID",
        text: `
Dear ${name},

Thank you for contacting DRIVEGRID.

We have received your inquiry and appreciate your interest in working with us.

Our team will review your message and get back to you shortly.

Best regards,

DRIVEGRID
The Intelligent Energy Platform for the Next EV Economy

https://www.drive-grid.com
        `,
      });

    if (confirmationError) {
      console.error(confirmationError);

      return NextResponse.json(
        {
          error:
            "Inquiry received, but confirmation email could not be sent.",
        },
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