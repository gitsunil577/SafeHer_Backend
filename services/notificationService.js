const config = require('../config/config');

/**
 * Clean phone number to 10-digit Indian mobile number
 */
function cleanPhone(phone) {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
  if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  return cleaned;
}

/**
 * Send SMS via Fast2SMS
 * Docs: https://docs.fast2sms.com
 */
async function sendSMS(to, message) {
  const apiKey = config.sms.fast2smsApiKey;
  const phone = cleanPhone(to);

  if (!apiKey) {
    console.log(`[SMS STUB] To: ${phone} | Message: ${message}`);
    return { success: true, stub: true };
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: phone
      })
    });

    const data = await response.json();

    if (data.return === true) {
      console.log(`[SMS] Sent to ${phone} | ID: ${data.request_id}`);
      return { success: true, requestId: data.request_id };
    } else {
      console.error(`[SMS ERROR] Fast2SMS:`, data.message);
      return { success: false, error: data.message };
    }
  } catch (err) {
    console.error(`[SMS ERROR] Failed to send to ${phone}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notify all emergency contacts for an SOS alert via SMS.
 */
async function notifyEmergencyContacts(contacts, user, alert) {
  const results = [];
  const [longitude, latitude] = alert.location.coordinates;
  const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  const smsMessage =
    `EMERGENCY! ${user.name} triggered SOS on SafeHer and needs help. ` +
    `Location: ${locationLink}`;

  for (const contact of contacts) {
    try {
      const smsResult = await sendSMS(contact.phone, smsMessage);
      results.push({
        contactId: contact._id,
        method: 'sms',
        status: smsResult.success ? 'sent' : 'failed'
      });
    } catch (err) {
      console.error(`[SMS ERROR] ${contact.phone}:`, err.message);
      results.push({ contactId: contact._id, method: 'sms', status: 'failed' });
    }
  }

  return results;
}

module.exports = { sendSMS, notifyEmergencyContacts };
