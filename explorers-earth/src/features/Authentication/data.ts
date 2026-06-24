import * as Yup from "yup";
import { validateUsername } from "../../utils/usernameValidation";
import { TFunction } from "i18next";

// Generic type for defining form data
export type FormValues = {
  [key: string]: string | boolean;
};

// Specific type for verification form data
export type VerificationFormValues = {
  name: string;
  email: string;
  phone: string;
  description: string;
  attachment: File | null;
};

// Custom Yup method for username validation
export const createUsernameValidation = (t: TFunction) => Yup.string()
  .required(t('auth.validations.username.required'))
  .test('username-validation', t('auth.validations.username.invalidChars'), function(value) {
    if (!value) return false;
    
    const validation = validateUsername(value, t);
    
    if (!validation.isValid) {
      // Map validation errors to i18n keys
      const errorMap: { [key: string]: string } = {
        'Username is required': t('auth.validations.username.required'),
        'Username must be at least 3 characters long': t('auth.validations.username.minLength'),
        'Username must not exceed 30 characters': t('auth.validations.username.maxLength'),
        'Username can only contain lowercase letters (a-z), numbers (0-9), and hyphens (-)': t('auth.validations.username.invalidChars'),
        'Username must start with a letter (a-z)': t('auth.validations.username.mustStartWithLetter'),
        'Username cannot start or end with a hyphen': t('auth.validations.username.cannotStartEndHyphen'),
        'Username cannot contain consecutive hyphens': t('auth.validations.username.noConsecutiveHyphens'),
        'Username cannot be all numbers': t('auth.validations.username.cannotBeAllNumbers'),
        'This username contains reserved words and cannot be used': t('auth.validations.username.reservedWords'),
        'Username contains inappropriate content': t('auth.validations.username.inappropriateContent'),
        'Username already exists': t('auth.validations.username.alreadyExists')
      };
      
      const errorMessage = validation.errors[0] || t('auth.validations.onboarding.invalidUsername');
      const translatedError = errorMap[errorMessage] || errorMessage;
      
      return this.createError({
        message: translatedError
      });
    }
    
    return true;
  });

// Validation schema
export const createLoginValidationSchema = (t: TFunction) => Yup.object({
  username: Yup.string().required(t('auth.validations.login.usernameOrEmailRequired')),
  password: Yup.string()
    .min(6, t('auth.validations.password.minLength'))
    .required(t('auth.validations.password.required')),
});

// Initial values for form fields
export const loginInitialValues = {
  username: "",
  password: "",
};

// Validation schema for Register
export const createRegisterValidationSchema = (t: TFunction) => {
  const schema: any = {
    username: createUsernameValidation(t),
    email: Yup.string()
      .email(t('auth.validations.email.invalidFormat'))
      .required(t('auth.validations.email.required')),
    password: Yup.string()
      .required(t('auth.validations.password.required'))
      .min(6, t('auth.validations.password.minLength'))
      .matches(/[A-Z]/, t('auth.validations.password.uppercaseRequired'))
      .matches(/[a-z]/, t('auth.validations.password.lowercaseRequired'))
      .matches(/[0-9]/, t('auth.validations.password.numberRequired'))
      .matches(/[!@#$%^&*().,?":{}|<>]/, t('auth.validations.password.specialCharRequired')),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password')], t('auth.validations.confirmPassword.mustMatch'))
      .required(t('auth.validations.confirmPassword.confirmRequired')),
    termsAccepted: Yup.boolean()
      .oneOf([true], t('auth.validations.termsAccepted.required')),
  };

  // Only require Turnstile if the site key is provided in the env
  if (import.meta.env.VITE_TURNSTILE_SITE_KEY) {
    schema.turnstileToken = Yup.string().required(t('auth.validations.turnstile.required', { defaultValue: 'Please complete the security check' }));
  }

  return Yup.object(schema);
};

// Initial values for form fields
export const registerInitialValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  turnstileToken: ""
};

// Translation functions for form fields
export const getLoginFormFields = (t: TFunction) => [
  {
    name: "username",
    label: t('auth.usernameOrEmail'),
    type: "text",
    placeholder: t('auth.usernameOrEmailPlaceholder'),
  },
  {
    name: "password",
    label: t('auth.password'),
    type: "password",
    placeholder: t('auth.passwordPlaceholder'),
  },
];

export const getRegisterFormFields = (t: TFunction) => [
  {
    name: "username",
    label: t('auth.username'),
    type: "text",
    placeholder: t('auth.usernamePlaceholder'),
  },
  {
    name: "email",
    label: t('auth.email'),
    type: "text",
    placeholder: t('auth.emailPlaceholder'),
  },
  {
    name: "password",
    label: t('auth.password'),
    type: "password",
    placeholder: t('auth.passwordPlaceholder'),
  },
  {
    name: "confirmPassword",
    label: t('auth.confirmPassword'),
    type: "password",
    placeholder: t('auth.confirmPasswordPlaceholder'),
  }
];

export const onboardingInitialValues = {
  accountName: "",
  username: "",
  bio: "",
  mobile_number: "",
  city: "",
  country: "",
  primaryLocation: "",
  accountType: "",
  localTunesConsent: false,
};

export const createOnboardingValidationSchema = (t: TFunction) => Yup.object({
  accountName: Yup.string()
    .required(t('auth.validations.onboarding.displayNameRequired'))
    .min(3, t('auth.validations.onboarding.displayNameMinLength')),
  username: createUsernameValidation(t),
  bio: Yup.string()
    .required(t('auth.validations.onboarding.bioRequired'))
    .max(250, t('auth.validations.onboarding.bioMaxLength')),
  mobile_number: Yup.string()
    .required(t('auth.validations.onboarding.mobileNumberRequired'))
    .matches(/^[0-9]+$/, t('auth.validations.onboarding.mobileNumberInvalid'))
    .min(10, t('auth.validations.onboarding.mobileNumberLength'))
    .max(15, t('auth.validations.onboarding.mobileNumberLength')),
  city: Yup.string().required(t('auth.validations.onboarding.cityRequired')),
  country: Yup.string().required(t('auth.validations.onboarding.countryRequired')),
  primaryLocation: Yup.string().required(t('auth.validations.onboarding.primaryAddressRequired')),
  accountType: Yup.string()
    .oneOf([t('auth.validations.accountType.personal'), t('auth.validations.accountType.creator'), t('auth.validations.accountType.business')], t('auth.validations.accountType.invalid'))
    .required(t('auth.validations.accountType.required')),
});

// Validation schema for Claim Account
export const claimAccountValidationSchema = Yup.object({
  phone: Yup.string()
    .default("")
    .matches(/^[0-9\s]*$/, "Phone number can contain digits and spaces")
    .test('phone-validation', 'Phone number must be at least 10 digits', function(value) {
      if (!value || value.trim().length === 0) return true; // Allow empty
      return value.length >= 10;
    })
    .max(20, "Phone number must not exceed 20 characters"),
  email: Yup.string()
    .default("")
    .test('email-validation', 'Please enter a valid email address', function(value) {
      if (!value || value.trim().length === 0) return true; // Allow empty
      return Yup.string().email().isValidSync(value);
    }),
  address: Yup.string()
    .default("")
    .test('address-validation', 'Please enter a complete address', function(value) {
      if (!value || value.trim().length === 0) return true; // Allow empty
      return value.length >= 5;
    }),
}).test('at-least-one-field', 'Please fill in at least one field (Phone, Email, or Address)', function(values) {
  const { phone, email, address } = values;
  const hasPhone = phone && phone.trim().length > 0;
  const hasEmail = email && email.trim().length > 0;
  const hasAddress = address && address.trim().length > 0;
  
  if (!hasPhone && !hasEmail && !hasAddress) {
    return this.createError({
      message: 'Please fill in at least one field (Phone, Email, or Address)',
      path: 'phone' // Show error on phone field
    });
  }
  
  return true;
});

// Initial values for claim account form
export const claimAccountInitialValues = {
  phone: "",
  email: "",
  address: "",
};

// Validation schema for Verification Step
export const verificationValidationSchema = Yup.object({
  name: Yup.string()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters")
    .matches(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  phone: Yup.string()
    .required("Phone number is required")
    .matches(/^[0-9\s]+$/, "Phone number can contain digits and spaces")
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number must not exceed 20 characters"),
  description: Yup.string()
    .required("Message is required")
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must not exceed 500 characters"),
  attachment: Yup.mixed<File>()
    .required("Verification document is required")
    .test("fileSize", "File size must be less than 5MB", (value) => {
      if (!value || !(value instanceof File)) return false; // Require file
      return value.size <= 5 * 1024 * 1024; // 5MB
    })
    .test("fileType", "Only PDF, DOC, DOCX, JPG, PNG files are allowed", (value) => {
      if (!value || !(value instanceof File)) return false; // Require file
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
      ];
      return allowedTypes.includes(value.type);
    }),
});

// Initial values for verification form
export const verificationInitialValues = {
  name: "",
  email: "",
  phone: "",
  description: "",
  attachment: null,
};

export const verificationFormFields = [
  {
    name: "name",
    label: "Full Name",
    type: "text",
    placeholder: "Enter your full name",
  },
  {
    name: "email",
    label: "Email Address",
    type: "email",
    placeholder: "Enter your email address",
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "text",
    placeholder: "Enter your phone number",
  },
  {
    name: "description",
    label: "Message",
    type: "textarea",
    placeholder: "Describe why you should be able to claim this place (minimum 10 characters)",
  },
  {
    name: "attachment",
    label: "Verification Document",
    type: "file",
    placeholder: "Upload a document to verify your claim (PDF, DOC, DOCX, JPG, PNG - Max 5MB)",
  },
];
