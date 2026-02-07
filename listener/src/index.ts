import express from 'express';
import cors from 'cors';

import * as dotenv from 'dotenv';
dotenv.config();

import logger from '../utils/logger';
import { startListener } from './listener';
import { withdraw } from './withdraw';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
	res.json({
		message: 'Ascend EVM Bridge API Server/Listener',
		status: 'Running 🚀',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
	});
});

app.post("/withdraw", withdraw);

const server = app.listen(PORT, () => {
	logger.info(`Server running on ${PORT}`);
	startListener();
});

process.on('SIGTERM', () => {
	server.close(() => {
		console.log('Process terminated');
	});
});
