import { Express } from 'express';
import { storage } from '../storage';
import { emailService } from '../services/email-service';

/**
 * Registers email API routes
 */
export function setupEmailRoutes(app: Express) {
  app.post('/api/email/send', async (req, res) => {
    const apiToken = req.headers.authorization?.split(' ')[1];
    if (!apiToken) {
      return res.status(401).json({ message: 'API token is required' });
    }

    try {
      const token = await storage.getApiTokenByToken(apiToken);
      if (!token || !token.isActive) {
        return res.status(401).json({ message: 'Invalid or inactive API token' });
      }

      await storage.updateApiTokenLastUsed(token.id);

      const { recipient, templateId, variables, subject } = req.body;

      if (!recipient || !templateId || !variables) {
        return res.status(400).json({
          message: 'Missing required fields',
          required: ['recipient', 'templateId', 'variables'],
        });
      }

      const configValidation = emailService.validateConfig();
      if (!configValidation.isValid) {
        return res.status(500).json({
          message: 'Email service is not properly configured',
          details: configValidation.message,
        });
      }

      const result = await emailService.sendEmail(
        recipient,
        templateId,
        variables,
        token.id,
        subject,
      );

      if (result.success) {
        res.json({
          message: 'Email sent successfully',
          messageId: result.messageId,
        });
      } else {
        res.status(400).json({
          message: 'Failed to send email',
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
