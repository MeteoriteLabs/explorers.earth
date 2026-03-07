import React from "react";
import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import Button from "../../../components/ui/Button";
import VerificationFileUpload from "../../../components/ui/VerificationFileUpload";
import { VerificationFormValues } from "../data";

interface VerificationFormProps {
  initialValues: VerificationFormValues;
  validationSchema: any;
  onSubmit: (values: VerificationFormValues, formikHelpers: FormikHelpers<VerificationFormValues>) => void | Promise<void>;
  submitButtonLabel?: string;
  isLoading?: boolean;
  heading: string;
  description?: string;
  onBack?: () => void;
}

const VerificationForm: React.FC<VerificationFormProps> = ({
  initialValues,
  validationSchema,
  onSubmit,
  submitButtonLabel = "Submit",
  isLoading = false,
  heading,
  description,
  onBack,
}) => {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, formikHelpers) => {
        await onSubmit(values, formikHelpers);
      }}
      enableReinitialize={false}
      validateOnChange={false}
      validateOnBlur={false}
      validateOnSubmit={false}
      resetForm={false}
    >
      {({ isSubmitting, values, setFieldValue, errors, touched }) => (
        <Form className="font-poppins flex flex-col gap-3 sm:gap-4 w-full">
          <div className="font-poppins px-2">
            <h1 className="font-semibold text-lg sm:text-2xl text-dashboard">{heading}</h1>
            <p className="text-xs sm:text-sm mt-1 text-dashboard-light">{description}</p>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4 md:gap-6">
            {/* Name Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="name"
                className="block text-xs sm:text-sm font-poppins text-dashboard-light font-semibold mb-1"
              >
                Full Name
              </label>
              <Field
                name="name"
                type="text"
                placeholder="Enter your full name"
                className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-xs sm:text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted"
                autoComplete="name"
              />
              <ErrorMessage
                name="name"
                component="span"
                className="text-xs font-poppins text-dashboard-danger"
              />
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="block text-xs sm:text-sm font-poppins text-dashboard-light font-semibold mb-1"
              >
                Email Address
              </label>
              <Field
                name="email"
                type="email"
                placeholder="Enter your email address"
                className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-xs sm:text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted"
                autoComplete="email"
              />
              <ErrorMessage
                name="email"
                component="span"
                className="text-xs font-poppins text-dashboard-danger"
              />
            </div>

            {/* Phone Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="block text-xs sm:text-sm font-poppins text-dashboard-light font-semibold mb-1"
              >
                Phone Number
              </label>
              <Field
                name="phone"
                type="text"
                placeholder="Enter your phone number"
                className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-xs sm:text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted"
                autoComplete="tel"
              />
              <ErrorMessage
                name="phone"
                component="span"
                className="text-xs font-poppins text-dashboard-danger"
              />
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="description"
                className="block text-xs sm:text-sm font-poppins text-dashboard-light font-semibold mb-1"
              >
                Message
              </label>
              <Field
                name="description"
                as="textarea"
                placeholder="Describe why you should be able to claim this place (minimum 10 characters)"
                className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-xs sm:text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted h-24 sm:h-32 resize-none"
              />
              <ErrorMessage
                name="description"
                component="span"
                className="text-xs font-poppins text-dashboard-danger"
              />
            </div>

            {/* File Upload Field */}
            <div className="flex flex-col gap-2">
              <VerificationFileUpload
                label="Verification Document"
                placeholder="Upload a document to verify your claim (PDF, DOC, DOCX, JPG, PNG - Max 5MB)"
                value={values.attachment}
                onChange={(file: File | null) => setFieldValue("attachment", file)}
                error={errors.attachment && touched.attachment ? errors.attachment : undefined}
              />

              {/* Document Reference List */}
              <div className="mt-2 p-3 sm:p-4 bg-dashboard-muted rounded-lg border border-dashboard">
                <h4 className="text-xs sm:text-sm font-semibold text-dashboard mb-2 sm:mb-3">Accepted Documents:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-dashboard-light">
                  <div>
                    <h5 className="font-medium text-dashboard mb-1 sm:mb-2 text-xs sm:text-sm">Proof of Identity:</h5>
                    <ul className="space-y-1">
                      <li className="break-words">• Passport</li>
                      <li className="break-words">• Driver's License</li>
                      <li className="break-words">• National or government-issued ID card</li>
                      <li className="break-words">• Voter ID card</li>
                      <li className="break-words">• Bank passbook with photograph</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-dashboard mb-1 sm:mb-2 text-xs sm:text-sm">Corporate Identity:</h5>
                    <ul className="space-y-1">
                      <li className="break-words">• Certificate of Incorporation (with CIN)</li>
                      <li className="break-words">• Memorandum and Articles of Association</li>
                      <li className="break-words">• Company PAN card or Tax Registration Certificate (GST, VAT, etc.)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            {onBack && (
              <Button
                type="button"
                onClick={onBack}
                variant="secondary"
                btnText="Back to Profile"
                className="flex-1 w-full"
              />
            )}
            <Button
              type="submit"
              variant="primary"
              btnText={submitButtonLabel}
              isLoading={isLoading || isSubmitting}
              disabled={isLoading || isSubmitting}
              className="flex-1 w-full"
            />
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default VerificationForm;
