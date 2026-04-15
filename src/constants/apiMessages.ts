/**
 * LabSync — API Message & Error Code Lookup Tables
 *
 * Usage:
 *   import { getSuccessMessage, getErrorMessage } from '@/constants/apiMessages';
 *
 *   // On success:
 *   const msg = getSuccessMessage(response.data.messageCode, response.data.message);
 *   if (msg) showToast(msg, 'success');
 *
 *   // On error:
 *   const msg = getErrorMessage(error.response?.data?.errorCode, error.response?.data?.message);
 *   showToast(msg || 'Something went wrong.', 'error');
 *
 * Notes:
 *   - messageCode is present only on 2xx responses.
 *   - errorCode is present only on 4xx/5xx responses.
 *   - {prefix}000 codes (e.g. US000) mean no specific code — getSuccessMessage returns the fallback.
 *   - Read operation codes (1xx) return '' by default — callers should skip toasting on empty strings.
 */

// ---------------------------------------------------------------------------
// Success message codes (messageCode on 2xx responses)
// ---------------------------------------------------------------------------

const MESSAGE_CODES: Record<string, string> = {
  // ── UserService (US) ─────────────────────────────────────────────────────
  // 1xx — reads (no toast needed, empty string)
  US100: '',
  US101: '',
  US102: '',
  US103: '',
  US104: '',
  US105: '',
  US106: '',
  US107: '',
  // 2xx — mutations
  US200: 'Google credential saved.',
  US201: 'Google auth code exchanged.',
  US202: 'User added successfully.',
  US203: 'User updated successfully.',
  US204: 'User deactivated.',
  US205: 'Profile updated successfully.',
  US206: 'Check-in logged.',
  // 3xx — auth
  US300: 'Logged in with Google.',
  US301: 'Logged in with Google.',
  US302: 'Token refreshed.',
  US303: 'Logged out.',
  US304: 'Logged in.',

  // ── ProjectService (PS) ──────────────────────────────────────────────────
  // Projects — reads
  PS100: '',
  PS101: '',
  PS102: '',
  PS103: '',
  // Projects — mutations
  PS200: 'Project created successfully.',
  PS201: 'Project updated successfully.',
  PS202: 'Project deleted.',
  PS203: 'Project archived.',

  // Milestones — reads
  PS110: '',
  PS111: '',
  PS112: '',
  // Milestones — mutations
  PS210: 'Milestone created.',
  PS211: 'Milestone updated.',
  PS212: 'Milestone deleted.',
  PS213: 'Milestones reordered.',
  PS214: 'Milestone status updated.',

  // Tasks — reads
  PS120: '',
  PS121: '',
  PS122: '',
  PS123: '',
  PS124: '',
  PS125: '',
  PS126: '',
  PS127: '',
  // Tasks — mutations
  PS220: 'Task created successfully.',
  PS221: 'Task updated successfully.',
  PS222: 'Task deleted.',
  PS223: 'Task status updated.',
  PS224: 'Tasks reordered.',

  // Memberships — reads
  PS130: '',
  PS131: '',
  PS132: '',
  PS133: '',
  PS134: '',
  // Memberships — mutations
  PS230: 'Member added successfully.',
  PS231: 'Membership updated.',
  PS232: 'Member removed.',
  PS233: 'Member role changed.',
  PS234: 'Members added successfully.',

  // Task members — reads
  PS140: '',
  // Task members — mutations
  PS240: 'Task member assigned.',
  PS241: 'Task member removed.',

  // Evidences — reads
  PS150: '',
  // Evidences — mutations
  PS250: 'Evidence uploaded.',
  PS251: 'Evidence deleted.',

  // ── NotificationService (NS) ─────────────────────────────────────────────
  // Reads
  NS100: '',
  NS101: '',
  // Mutations
  NS200: 'Notification marked as read.',
  NS201: 'All notifications marked as read.',
  NS202: 'Notification deleted.',
  NS203: 'All notifications deleted.',

  // ── BookingService (BS) ──────────────────────────────────────────────────
  // Bookings — reads
  BS100: '',
  BS101: '',
  BS102: '',
  BS103: '',
  BS104: '',
  BS105: '',
  // Bookings — mutations
  BS200: 'Booking created successfully.',
  BS201: 'Booking updated.',
  BS202: 'Booking cancelled.',
  BS203: 'Booking approved.',
  BS204: 'Booking rejected.',
  BS205: 'Bookings approved in bulk.',

  // Resources — reads
  BS110: '',
  BS111: '',
  BS112: '',
  BS113: '',
  BS114: '',
  // Resources — mutations
  BS210: 'Resource created.',
  BS211: 'Resource updated.',
  BS212: 'Resource assigned.',
  BS213: 'Resource deleted.',

  // ── MeetingService (MS) ──────────────────────────────────────────────────
  // Meetings — reads
  MS100: '',
  MS101: '',
  MS102: '',
  MS103: '',
  // Meetings — mutations
  MS200: 'Meeting created successfully.',
  MS201: 'Meeting updated.',
  MS202: 'Meeting deleted.',
  MS203: 'Meeting embedding updated.',
  MS204: 'Meeting details updated.',

  // Seminars — reads
  MS110: '',
  MS111: '',
  MS112: '',
  MS113: '',
  MS114: '',
  MS115: '',
  // Seminars — mutations
  MS210: 'Recurring seminar created.',
  MS211: 'Swap request submitted.',
  MS212: 'Swap request responded.',
  MS213: 'Seminar meeting updated.',

  // ── PaperSubmissionService (PSS) ─────────────────────────────────────────
  // Reads
  PSS100: '',
  PSS101: '',
  PSS102: '',
  // Mutations
  PSS200: 'Paper submitted successfully.',
  PSS201: 'Paper updated.',
  PSS202: 'Paper deleted.',
  PSS203: 'Paper status changed.',
  PSS204: 'External users added.',
  PSS205: 'External user updated.',
  PSS206: 'External user removed.',

  // ── TranscriptionService (TS) ────────────────────────────────────────────
  // Reads
  TS100: '',
  TS101: '',
  TS102: '',
  TS103: '',
  TS104: '',
  // Mutations
  TS200: 'Transcription created.',
  TS201: 'Task suggestions generated.',
  TS202: 'Transcription deleted.',
  TS203: 'Summary generated.',
  TS204: 'OpenAI config updated.',
  TS205: 'API key validated.',
  TS206: 'Chat model removed.',
};

// ---------------------------------------------------------------------------
// Error codes (errorCode on 4xx/5xx responses)
// ---------------------------------------------------------------------------

const ERROR_CODES: Record<string, string> = {
  // ── UserService (US) ─────────────────────────────────────────────────────
  US001: 'An unexpected error occurred.',
  US003: 'This resource already exists.',
  US004: 'User not found.',
  US006: 'This action is not allowed at this time.',
  US007: 'Invalid input. Please check your data.',
  US010: 'Server configuration error. Please contact support.',
  US999: 'An unhandled server error occurred.',
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the user-facing success message for a `messageCode`.
 *
 * - Returns `fallback` when the code is absent, unknown, or is a generic
 *   `{prefix}000` code (e.g. "US000") which signals no specific operation.
 * - Returns `''` for read-operation codes (1xx) — callers should skip
 *   showing a toast when the result is an empty string.
 */
export function getSuccessMessage(
  messageCode: string | undefined,
  fallback = '',
): string {
  if (!messageCode) return fallback;
  if (messageCode.endsWith('000')) return fallback;
  const mapped = MESSAGE_CODES[messageCode];
  if (mapped === undefined) return fallback;
  return mapped;
}

/**
 * Returns the user-facing error message for an `errorCode`.
 *
 * Falls back to `fallback` (typically `response.message`) when the code is
 * absent or not yet mapped.
 */
export function getErrorMessage(
  errorCode: string | undefined,
  fallback = 'Something went wrong.',
): string {
  if (!errorCode) return fallback;
  return ERROR_CODES[errorCode] ?? fallback;
}
