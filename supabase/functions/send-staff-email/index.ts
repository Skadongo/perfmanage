declare const Deno;

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { type, recipientEmail, recipientName, newRole, resetLink } = await req?.json();

    const RESEND_API_KEY = Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let subject = "";
    let htmlBody = "";

    if (type === "password_reset") {
      subject = "Action Required: Reset Your ECSA-HC PMS Password";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
          <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">ECSA-HC Performance Management System</h1>
          </div>
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1e3a5f; font-size: 18px; margin-top: 0;">Password Reset Required</h2>
            <p style="color: #374151; line-height: 1.6;">Dear ${recipientName || "Staff Member"},</p>
            <p style="color: #374151; line-height: 1.6;">
              An administrator has initiated a password reset for your ECSA-HC PMS account. You will be required to set a new password on your next login.
            </p>
            ${resetLink ? `
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="background: #1e3a5f; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Reset My Password
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; text-align: center;">
              If the button above doesn't work, copy and paste this link into your browser:<br/>
              <a href="${resetLink}" style="color: #1e3a5f; word-break: break-all;">${resetLink}</a>
            </p>
            ` : `
            <p style="color: #374151; line-height: 1.6;">
              Please log in to the ECSA-HC PMS at <a href="https://pms.ecsahc.int" style="color: #1e3a5f;">pms.ecsahc.int</a> and follow the prompts to update your password.
            </p>
            `}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
              If you did not expect this action or believe it was made in error, please contact your HR administrator immediately.<br/>
              This is an automated message from the ECSA-HC Performance Management System.
            </p>
          </div>
        </div>
      `;
    } else if (type === "role_change") {
      subject = "Your ECSA-HC PMS Role Has Been Updated";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
          <div style="background: #1e3a5f; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">ECSA-HC Performance Management System</h1>
          </div>
          <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #1e3a5f; font-size: 18px; margin-top: 0;">Role Assignment Updated</h2>
            <p style="color: #374151; line-height: 1.6;">Dear ${recipientName || "Staff Member"},</p>
            <p style="color: #374151; line-height: 1.6;">
              Your role in the ECSA-HC Performance Management System has been updated by an administrator.
            </p>
            ${newRole ? `
            <div style="background: #f0f4ff; border-left: 4px solid #1e3a5f; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #1e3a5f; font-weight: 600; font-size: 15px;">New Role: ${newRole}</p>
            </div>
            ` : ""}
            <p style="color: #374151; line-height: 1.6;">
              Your updated permissions and access levels are now active. Please log in to the system to review your new role and available features.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="https://pms.ecsahc.int" style="background: #1e3a5f; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                Log In to PMS
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
              If you have questions about your new role or access level, please contact your HR administrator.<br/>
              This is an automated message from the ECSA-HC Performance Management System.
            </p>
          </div>
        </div>
      `;
    } else {
      throw new Error(`Unknown email type: ${type}`);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    if (!response?.ok) {
      const errorData = await response?.json();
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response?.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
