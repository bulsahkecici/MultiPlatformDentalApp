async function status(req, res) {
  return res.status(200).json({
    ok: true,
    user: { email: req.user.email, roles: req.user.roles },
  });
}

module.exports = { status };
