// Cloudflare Pages Function: /api/admin
// Admin-only endpoint to view all users' progress, attempts, and question confidence

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = JSON.parse(atob(token));
    if (payload.exp && payload.exp > Date.now()) {
      return payload;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = verifyToken(request.headers.get('Authorization'));

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const db = env.DB;

  try {
    // Query all users and aggregate their stats
    const usersQuery = await db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.role, 
        u.created_at, 
        u.last_login,
        COUNT(DISTINCT a.id) as total_attempts,
        MAX(a.percentage) as best_score,
        AVG(a.percentage) as avg_score,
        SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
        (
          SELECT COUNT(*) 
          FROM question_mastery qm 
          WHERE qm.user_id = u.id AND qm.times_correct >= 2
        ) as confident_questions
      FROM users u
      LEFT JOIN exam_attempts a ON u.id = a.user_id
      GROUP BY u.id
      ORDER BY u.last_login DESC
    `).all();

    // Query global summary
    const globalSummary = await db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM exam_attempts) as total_exams_taken,
        (SELECT AVG(percentage) FROM exam_attempts) as platform_avg_score,
        (SELECT COUNT(*) FROM exam_attempts WHERE passed = 1) as total_passed_exams
    `).first();

    return new Response(JSON.stringify({
      summary: {
        total_users: globalSummary?.total_users || 0,
        total_exams_taken: globalSummary?.total_exams_taken || 0,
        platform_avg_score: Math.round(globalSummary?.platform_avg_score || 0),
        total_passed_exams: globalSummary?.total_passed_exams || 0
      },
      users: (usersQuery.results || []).map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
        last_login: u.last_login,
        total_attempts: u.total_attempts || 0,
        best_score: u.best_score !== null ? u.best_score : '-',
        avg_score: u.avg_score !== null ? Math.round(u.avg_score) : '-',
        passed_attempts: u.passed_attempts || 0,
        confident_questions: u.confident_questions || 0,
        mastery_percentage: Math.round(((u.confident_questions || 0) / 60) * 100)
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
