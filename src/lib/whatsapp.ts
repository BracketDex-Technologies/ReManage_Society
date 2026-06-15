export async function sendWhatsAppMessage(
  toPhone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!phoneNumberId || !token) {
    return { success: false, error: "WhatsApp API not configured" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: `91${toPhone.replace(/\D/g, "")}`,
          type: "text",
          text: { body: message },
        }),
      }
    );
    const data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export const defaultTemplates = {
  english: `Dear {ownerName},

Your maintenance of ₹{amount} for {period} at {societyName} - Flat {flatNumber} is pending.
Please pay by {dueDate}.

UPI: {upiId}

Regards,
{chairmanName}`,

  marathi: `नमस्कार {ownerName},

{societyName} - Flat {flatNumber} चे {period} चे देखभाल शुल्क ₹{amount} बाकी आहे.
कृपया {dueDate} पर्यंत भरावे.

UPI: {upiId}

धन्यवाद,
{chairmanName}`,
};
