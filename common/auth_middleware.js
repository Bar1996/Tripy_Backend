const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    console.log('authMiddleware');

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).send("No token provided");
    }
    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send("Invalid token");
        }
        req.body.user = user;
        next();
    });
}

module.exports = authMiddleware;
