import AWS from 'aws-sdk';
import Handlebars from 'handlebars';
import { 
  EmailTemplate, InsertEmailTemplate, 
  EmailLog, InsertEmailLog,
  ApiToken
} from '@shared/schema';
import { storage } from '../storage';
import crypto from 'crypto';
import { systemSettingsService } from '../services/system-settings-service';

export class EmailService {
  private ses: AWS.SES;
  private fromEmail: string;
  
  constructor() {
    // Log which AWS SES environment variables are set for debugging purposes
    console.log('AWS Config:', {
      regionSet: !!process.env.AWS_REGION,
      accessKeySet: !!process.env.AWS_ACCESS_KEY_ID,
      secretKeySet: !!process.env.AWS_SECRET_ACCESS_KEY,
      senderEmailSet: !!process.env.AWS_SES_SENDER_EMAIL
    });

    let secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    if (secretAccessKey === '${AWS_SECRET_ACCESS_KEY}' || secretAccessKey === '**AWS_SECRET_ACCESS_KEY**') {
      console.error('AWS_SECRET_ACCESS_KEY is using a placeholder value, AWS SES will not work properly.');
    }

    // Initialize AWS SES with credentials from environment variables
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: secretAccessKey
      }
    });
    
    // Get from email from environment variables
    this.fromEmail = process.env.AWS_SES_SENDER_EMAIL || 'noreply@example.com';
  }
  
  /**
   * Renders an email template with the provided variables
   */
  private renderTemplate(template: EmailTemplate, variables: Record<string, any>): { html: string; text: string } {
    try {
      // Compile HTML template
      const htmlTemplate = Handlebars.compile(template.html_content);
      const html = htmlTemplate(variables);
      
      // Compile text template
      const textTemplate = Handlebars.compile(template.text_content);
      const text = textTemplate(variables);
      
      return { html, text };
    } catch (error) {
      console.error('Error rendering email template:', error);
      throw new Error(`Failed to render email template: ${(error as Error).message}`);
    }
  }
  
  /**
   * Validates that the required AWS SES environment variables are set
   */
  public validateConfig(): { isValid: boolean; message?: string } {
    if (!process.env.AWS_REGION) {
      return { isValid: false, message: 'AWS_REGION environment variable is not set' };
    }
    
    if (!process.env.AWS_ACCESS_KEY_ID) {
      return { isValid: false, message: 'AWS_ACCESS_KEY_ID environment variable is not set' };
    }
    
    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      return { isValid: false, message: 'AWS_SECRET_ACCESS_KEY environment variable is not set' };
    }
    
    if (process.env.AWS_SECRET_ACCESS_KEY === '${AWS_SECRET_ACCESS_KEY}' || 
        process.env.AWS_SECRET_ACCESS_KEY === '**AWS_SECRET_ACCESS_KEY**') {
      return { isValid: false, message: 'AWS_SECRET_ACCESS_KEY has a placeholder value, please set a valid key' };
    }
    
    if (!process.env.AWS_SES_SENDER_EMAIL) {
      return { isValid: false, message: 'AWS_SES_SENDER_EMAIL environment variable is not set' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Sends an email using a template
   */
  public async sendEmail(
    recipient: string,
    templateId: number,
    variables: Record<string, any>,
    apiTokenId?: number,
    subject?: string
  ): Promise<{ 
    success: boolean; 
    messageId?: string; 
    error?: string;
    permissionError?: boolean;
    emailLogId?: number;
  }> {
    try {
      // Validate AWS SES config
      const configValidation = this.validateConfig();
      if (!configValidation.isValid) {
        throw new Error(configValidation.message);
      }
      
      // Get template
      const template = await storage.getEmailTemplateById(templateId);
      if (!template) {
        throw new Error(`Email template with ID ${templateId} not found`);
      }
      
      // Render template with variables
      const { html, text } = this.renderTemplate(template, variables);
      
      // Use template subject if no custom subject provided
      const emailSubject = subject || template.subject;
      
      // Create email log first with 'pending' status
      const emailLog = await storage.createEmailLog({
        recipient,
        subject: emailSubject,
        templateId,
        status: 'pending',
        apiTokenId,
        metadata: variables as any
      });
      
      // Send email via SES
      const params: AWS.SES.SendEmailRequest = {
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [recipient]
        },
        Message: {
          Subject: {
            Data: emailSubject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8'
            },
            Text: {
              Data: text,
              Charset: 'UTF-8'
            }
          }
        }
      };
      
      // Send email
      const result = await this.ses.sendEmail(params).promise();
      
      // Update log with success status and message ID
      await storage.updateEmailLogStatus(
        emailLog.id,
        'sent',
        result.MessageId
      );
      
      return {
        success: true,
        messageId: result.MessageId,
        emailLogId: emailLog.id
      };
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Check if it's a permissions error
      const errorMessage = (error as Error).message;
      const isPermissionsError = 
        errorMessage.includes('AccessDenied') || 
        errorMessage.includes('not authorized to perform');
      
      // If email parameters were provided, log the failure
      let emailLogId;
      if (recipient && templateId) {
        try {
          // Try to get the template to create a log entry
          const template = await storage.getEmailTemplateById(templateId);
          if (template) {
            const emailLog = await storage.createEmailLog({
              recipient,
              subject: subject || template.subject,
              templateId,
              status: 'failed',
              apiTokenId,
              errorMessage: (error as Error).message,
              metadata: variables as any
            });
            emailLogId = emailLog.id;
          }
        } catch (logError) {
          console.error('Error creating email log for failed email:', logError);
        }
      }
      
      // Create a more user-friendly error message for permission issues
      let friendlyErrorMessage = errorMessage;
      if (isPermissionsError) {
        friendlyErrorMessage = `AWS SES permissions issue: The AWS user does not have permission to send emails. Please update the IAM policy to include the ses:SendEmail and ses:SendRawEmail permissions.`;
      }
      
      return {
        success: false,
        error: friendlyErrorMessage,
        permissionError: isPermissionsError,
        emailLogId
      };
    }
  }
  
  /**
   * Gets email service usage metrics
   */
  public async getMetrics(): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    daily: { date: string; count: number; status: string }[];
  }> {
    return storage.getEmailStats();
  }
  
  /**
   * Verifies an email address with Amazon SES
   * This is required before you can send emails to new addresses in sandbox mode
   */
  public async verifyEmailAddress(email: string): Promise<{ 
    success: boolean; 
    message?: string;
    permissionError?: boolean;
  }> {
    try {
      const params: AWS.SES.VerifyEmailIdentityRequest = {
        EmailAddress: email
      };
      
      await this.ses.verifyEmailIdentity(params).promise();
      
      return {
        success: true,
        message: `Verification email sent to ${email}. Please check your inbox and follow the instructions.`
      };
    } catch (error) {
      console.error('Error verifying email address:', error);
      
      // Check if it's a permissions error
      const errorMessage = (error as Error).message;
      const isPermissionsError = 
        errorMessage.includes('AccessDenied') || 
        errorMessage.includes('not authorized to perform');
      
      if (isPermissionsError) {
        return {
          success: false,
          permissionError: true,
          message: `AWS SES permissions issue: The AWS user does not have permission to verify email addresses. Please update the IAM policy to include the ses:VerifyEmailIdentity permission.`
        };
      }
      
      return {
        success: false,
        message: `Failed to verify email: ${errorMessage}`
      };
    }
  }
  
  /**
   * Gets the sending quota for the AWS SES account
   */
  public async getSendingQuota(): Promise<{
    max24HourSend: number;
    sentLast24Hours: number;
    maxSendRate: number;
    permissionError?: boolean;
    errorMessage?: string;
  }> {
    try {
      const result = await this.ses.getSendQuota().promise();
      
      return {
        max24HourSend: result.Max24HourSend || 0,
        sentLast24Hours: result.SentLast24Hours || 0,
        maxSendRate: result.MaxSendRate || 0
      };
    } catch (error) {
      console.error('Error getting SES sending quota:', error);
      
      // Check if it's a permissions error
      const errorMessage = (error as Error).message;
      const isPermissionsError = 
        errorMessage.includes('AccessDenied') || 
        errorMessage.includes('not authorized to perform');
      
      // Instead of throwing, return an object with error information
      return {
        max24HourSend: 0,
        sentLast24Hours: 0,
        maxSendRate: 0,
        permissionError: isPermissionsError,
        errorMessage: errorMessage
      };
    }
  }

  /**
   * Generates a verification token for email verification
   */
  public generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sends an email verification email to a user
   */
  public async sendEmailVerification(
    userId: number,
    email: string,
    username: string
  ): Promise<{ 
    success: boolean; 
    message?: string;
    error?: string;
  }> {
    try {
      // Generate verification token and set expiry time (24 hours from now)
      const token = this.generateVerificationToken();
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 24);

      // Update user record with verification token and expiry
      const updated = await storage.updateUserVerificationToken(userId, token, expiryDate);
      if (!updated) {
        throw new Error(`Failed to update user with verification token`);
      }

      // Get the verification email template (ID 6)
      const verificationTemplateId = 6; // ID of the email verification template
      
      // Get app URL from system settings with fallback to BASE_URL env variable
      const baseUrl = await systemSettingsService.getAppUrl();
      
      if (!baseUrl) {
        console.error('Application URL is not configured - cannot send verification email');
        throw new Error('Application URL is not configured. Please set the app_url system setting or BASE_URL environment variable.');
      }
      
      console.log('Using base URL for email verification:', baseUrl);
      const verificationLink = `${baseUrl}/verify-email?token=${token}`;
      
      // Create variables for email template
      const variables = {
        username,
        verificationLink,
        currentYear: new Date().getFullYear().toString()
      };
      
      // Send the verification email
      const result = await this.sendEmail(
        email,
        verificationTemplateId,
        variables
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        message: `Verification email sent to ${email}`
      };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return {
        success: false,
        error: `Failed to send verification email: ${(error as Error).message}`
      };
    }
  }

  /**
   * Verifies a user's email using the verification token
   */
  public async verifyUserEmail(token: string): Promise<{ 
    success: boolean; 
    message?: string;
    error?: string;
    userId?: number;
  }> {
    try {
      // Find user with matching verification token
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }
      
      // Check if token is expired
      if (user.emailVerificationExpiry && new Date() > new Date(user.emailVerificationExpiry)) {
        return {
          success: false,
          error: 'Verification token has expired'
        };
      }
      
      // Update user to mark email as verified and clear token
      const updated = await storage.markEmailAsVerified(user.id);
      
      if (!updated) {
        throw new Error('Failed to mark email as verified');
      }
      
      return {
        success: true,
        message: 'Email verified successfully',
        userId: user.id
      };
    } catch (error) {
      console.error('Error verifying email:', error);
      return {
        success: false,
        error: `Failed to verify email: ${(error as Error).message}`
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();