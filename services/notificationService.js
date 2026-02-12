const config = require('../config/config');

let twilioClient = null;

/**
 * Normalize phone number to E.164 format.
 * If no country code prefix (+), adds the default country code from config.
 */
function normalizePhone(phone) {
  // Strip spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Already has country code
  if (cleaned.startsWith('+')) return cleaned;

  // Add default country code (India +91)
  const defaultCode = config.twilio.defaultCountryCode || '+91';
  return defaultCode + cleaned;
}

function getClient() {
  if (!twilioClient) {
    const { accountSid, authToken } = config.twilio;
    if (!accountSid || !authToken || accountSid === 'your_twilio_account_sid') {
      console.warn('Twilio credentials not configured - SMS/call notifications disabled');
      return null;
    }
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Send an SMS message via Twilio
 */
async function sendSMS(to, message) {
  const normalized = normalizePhone(to);
  const client = getClient();
  if (!client) {
    console.log(`[SMS STUB] To: ${normalized} | Message: ${message}`);
    return { success: true, stub: true };
  }

  const result = await client.messages.create({
    body: message,
    from: config.twilio.phoneNumber,
    to: normalized
  });

  console.log(`[SMS] Sent to ${to} | SID: ${result.sid}`);
  return { success: true, sid: result.sid };
}

/**
 * Make a voice call via Twilio with a TwiML message
 */
async function makeCall(to, message) {
  const normalized = normalizePhone(to);
  const client = getClient();
  if (!client) {
    console.log(`[CALL STUB] To: ${normalized} | Message: ${message}`);
    return { success: true, stub: true };
  }

  const twiml = `<Response><Say voice="alice" loop="2">${message}</Say></Response>`;

  const result = await client.calls.create({
    twiml,
    from: config.twilio.phoneNumber,
    to: normalized
  });

  console.log(`[CALL] Initiated to ${to} | SID: ${result.sid}`);
  return { success: true, sid: result.sid };
}

/**
 * Notify all emergency contacts for an SOS alert.
 * - SMS with live location link sent to ALL contacts
 * - Phone call made to PRIMARY contact only
 *
 * Returns array of { contactId, method, status } results
 */
async function notifyEmergencyContacts(contacts, user, alert) {
  const results = [];
  const [longitude, latitude] = alert.location.coordinates;
  const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  const smsMessage =
    `EMERGENCY ALERT! ${user.name} has triggered an SOS alert. ` +
    `They need help. Live location: ${locationLink}`;

  const callMessage =
    `Emergency alert. ${user.name} has triggered an SOS emergency alert and needs immediate help. ` +
    `Please check your text messages for their live location. This is an automated call from SafeHer.`;

  for (const contact of contacts) {
    // Send SMS to every contact
    try {
      await sendSMS(contact.phone, smsMessage);
      results.push({ contactId: contact._id, method: 'sms', status: 'sent' });
    } catch (err) {
      console.error(`[SMS ERROR] Failed to send to ${contact.phone}:`, err.message);
      results.push({ contactId: contact._id, method: 'sms', status: 'failed' });
    }

    // Make call to primary contact only
    if (contact.isPrimary) {
      try {
        await makeCall(contact.phone, callMessage);
        results.push({ contactId: contact._id, method: 'call', status: 'sent' });
      } catch (err) {
        console.error(`[CALL ERROR] Failed to call ${contact.phone}:`, err.message);
        results.push({ contactId: contact._id, method: 'call', status: 'failed' });
      }
    }
  }

  return results;
}

module.exports = { sendSMS, makeCall, notifyEmergencyContacts };
