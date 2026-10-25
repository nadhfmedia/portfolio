// Pengiriman email lewat Resend.
//
// Resend dipanggil lewat HTTP biasa (fetch bawaan Node 18+),
// tanpa paket tambahan, supaya ketergantungan proyek tidak bertambah.
//
// Variabel lingkungan yang dibutuhkan:
//   RESEND_API_KEY  -- kunci API dari https://resend.com
//   RESEND_FROM     -- alamat pengirim, misalnya "Portfolio <noreply@resend.dev>"
//                      Kalau belum diatur, memakai alamat bawaan onboarding Resend.

const KUNCI_API = process.env.RESEND_API_KEY || '';
const PENGIRIM = process.env.RESEND_FROM || 'Portfolio <onboarding@resend.dev>';

/**
 * Kirim satu email lewat Resend.
 *
 * @param {{ kepada: string, subjek: string, html: string }} opsi
 * @returns {Promise<{ ok: boolean, id?: string, pesan?: string }>}
 */
export async function kirimEmail({ kepada, subjek, html }) {
  if (!KUNCI_API) {
    console.error('RESEND_API_KEY belum diatur. Email tidak terkirim.');
    return { ok: false, pesan: 'RESEND_API_KEY belum diatur.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KUNCI_API}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: PENGIRIM,
        to: [kepada],
        subject: subjek,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', res.status, data);
      return { ok: false, pesan: data.message || 'Gagal mengirim email.' };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    console.error('Gagal menghubungi Resend:', err.message);
    return { ok: false, pesan: err.message };
  }
}
