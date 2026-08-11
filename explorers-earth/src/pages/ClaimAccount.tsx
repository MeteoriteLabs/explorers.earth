import { useLazyQuery, useMutation } from "@apollo/client";
import { useState } from "react";
import {
  claimAccountInitialValues,
  FormValues,
  claimAccountValidationSchema,
  verificationInitialValues,
  verificationValidationSchema,
  VerificationFormValues,
} from "../features/Authentication/data";
import VerificationForm from "../features/Authentication/components/VerificationForm";
import { checkClaimablePlaceProfileByPhoneQuery, checkClaimablePlaceProfileByAddressQuery, createVerifyClaimMutation } from "../features/Authentication/api/queries";
import { Formik, Form, Field, ErrorMessage, FormikHelpers } from "formik";
import { useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createWebPageGEOData } from "../utils/geoHelpers";
import PlaceProfileCard from "../features/Authentication/components/PlaceProfileCard";
import { toast } from "sonner";
import axios from "axios";
import { generateRandomFileName } from "../utils/uploadPathGenerator";
import useAuthStore from "../store/store";
import AddressInput from "../features/Profile/components/AddressInput";
import Button from "../components/ui/Button";

const ClaimAccount = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [checkClaimableProfileByPhone, { loading: phoneLoading }] = useLazyQuery(checkClaimablePlaceProfileByPhoneQuery);
  const [checkClaimableProfileByAddress, { loading: addressLoading }] = useLazyQuery(checkClaimablePlaceProfileByAddressQuery);
  const [createVerifyClaim, { loading: verifyLoading }] = useMutation(createVerifyClaimMutation);
  const [currentStep, setCurrentStep] = useState(0);
  const [foundProfile, setFoundProfile] = useState<any>(null);
  const [formData, setFormData] = useState<FormValues>(claimAccountInitialValues);
  const [verificationData, setVerificationData] = useState<VerificationFormValues>(verificationInitialValues);

  const steps = ["Search", "Profile Details", "Verify Yourself"];
  const loading = phoneLoading || addressLoading;

  const handleSubmit = async (
    values: FormValues,
    formikHelpers: FormikHelpers<FormValues>
  ) => {
    try {
      // Save form data
      setFormData(values);

      const hasPhone = values.phone && (values.phone as string).trim().length > 0;
      const hasAddress = values.address && (values.address as string).trim().length > 0;

      let matchingProfiles: any[] = [];

      // Search by phone number (exact match only)
      if (hasPhone) {
        const response = await checkClaimableProfileByPhone({
          variables: { phone: (values.phone as string).trim() }
        });

        const profiles = response.data?.claimablePlaceProfiles || [];
        matchingProfiles = profiles;
      }

      // If no phone match and we have address, search by address
      if (matchingProfiles.length === 0 && hasAddress) {
        const response = await checkClaimableProfileByAddress({
          variables: { address: (values.address as string).trim() }
        });

        const profiles = response.data?.claimablePlaceProfiles || [];
        matchingProfiles = profiles;
      }

      if (matchingProfiles && matchingProfiles.length > 0) {
        // Claimable place profile found - move to step 2
        const profile = matchingProfiles[0];
        setFoundProfile(profile);
        setCurrentStep(1);
        toast.success("Account found! Here are the details.");
      } else {
        // No claimable place profile found - show toast
        toast.error("No account found with the provided details.");
      }
    } catch (err) {
      toast.error("An error occurred while searching. Please try again later.");
    } finally {
      formikHelpers.setSubmitting(false);
    }
  };

  const handleBackToSearch = () => {
    setCurrentStep(0);
    setFoundProfile(null);
  };

  const handleClaimPlace = () => {
    // Move to verification step instead of claiming directly
    setCurrentStep(2);
  };

  const handleBackToProfile = () => {
    setCurrentStep(1);
  };

  const handleVerificationSubmit = async (
    values: VerificationFormValues,
    formikHelpers: FormikHelpers<VerificationFormValues>
  ) => {
    try {
      setVerificationData(values);

      // First upload the file (now mandatory)
      let attachmentUrl = null;
      if (!values.attachment) {
        toast.error("Verification document is required");
        formikHelpers.setSubmitting(false);
        return;
      }

      try {
        const formData = new FormData();

        // Generate structured path for verification documents
        const randomFileName = generateRandomFileName(values.attachment.name);
        const structuredPath = `verification/${randomFileName}`;

        formData.append("files", values.attachment);
        formData.append("path", structuredPath);

        // Upload file to Strapi
        const uploadResponse = await axios.post(
          `${import.meta.env.VITE_REST_API_URL}/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: token
                ? `Bearer ${token}`
                : `Bearer ${import.meta.env.VITE_PUBLIC_ACCESS_TOKEN}`,
            },
          }
        );

        if (uploadResponse.data && uploadResponse.data[0]?.id) {
          attachmentUrl = uploadResponse.data[0].id;
        } else {
          throw new Error("No file ID returned from upload");
        }
      } catch (uploadError) {
        toast.error("File upload failed. Please try again.");
        formikHelpers.setSubmitting(false);
        return;
      }

      // Create verify claim record
      const result = await createVerifyClaim({
        variables: {
          data: {
            Name: values.name,
            Email: values.email,
            Phone: values.phone,
            Message: values.description,
            Attachment: attachmentUrl,
          },
        },
      });

      if (result.data) {
        toast.success("Verification request submitted successfully! We'll review your claim and contact you soon.");
        // Redirect to home page after successful submission
        navigate("/");
      }
    } catch (err) {
      toast.error("An error occurred while submitting your verification. Please try again.");
    } finally {
      formikHelpers.setSubmitting(false);
    }
  };

  // Generate GEO data for claim account page
  const geoData = createWebPageGEOData({
    pageType: 'claim-explorers-account',
    title: 'Claim Your explorers Account',
    description: 'Check if your explorers account exists in our system by providing your phone number, email, or address',
    keywords: ['claim explorers account', 'account verification', 'find account', 'account lookup'],
    purpose: 'help users find and claim their existing explorers accounts'
  });

  return (
    <>
      <SEO
        title="Claim Your explorers Account | Find Your Existing Account"
        description="Lost access to your explorers account? Enter your phone number, email, or address to check if your account exists in our system and get help claiming it back."
        keywords={[
          "claim explorers account",
          "find existing account",
          "account recovery",
          "lost account access",
          "account lookup",
          "recover account",
          "find my account",
          "account verification",
          "account search",
          "account exists check"
        ]}
        canonical={createCanonicalUrl("/claimaccount")}
        type="website"
        noIndex={true}
        enableGEO={true}
        geoData={geoData}
      />

      <div className="dashboard-theme dashboard-theme-dark flex items-center justify-center min-h-screen bg-black p-4">
        <div className="relative w-full max-w-2xl bg-dashboard-sidebar rounded-lg shadow-dashboard-elevated p-4 md:p-6">
          {/* Stepper - Inside the form container */}
          <div className="mb-8">
            <div className="flex justify-between mb-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`flex-1 text-center ${index <= currentStep ? "text-dashboard-accent" : "text-dashboard-light"
                    }`}
                >
                  <div
                    className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-2 ${index <= currentStep ? "bg-dashboard-accent text-dashboard" : "bg-dashboard-muted text-dashboard-light"
                      }`}
                  >
                    {index < currentStep ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{step}</p>
                </div>
              ))}
            </div>
            <div className="flex">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-1 rounded-full ${index < currentStep ? "bg-dashboard-accent" : "bg-dashboard-muted"
                    }`}
                />
              ))}
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 0 ? (
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <div className="font-poppins flex flex-col gap-4 w-full">
                  <div className="font-poppins">
                    <h1 className="font-semibold text-2xl text-dashboard">Find Your explorers Account</h1>
                    <p className="text-sm mt-1 text-dashboard-light">Enter your phone number and address to search for your explorers account</p>
                  </div>

                  <Formik
                    initialValues={formData}
                    validationSchema={claimAccountValidationSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize={false}
                    validateOnChange={false}
                    validateOnBlur={false}
                    validateOnSubmit={false}
                    resetForm={false}
                  >
                    {({ isSubmitting, values, setFieldValue, errors, touched }) => (
                      <Form className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4">
                          {/* Phone Field */}
                          <div className="flex flex-col gap-2">
                            <label
                              htmlFor="phone"
                              className="block text-sm font-poppins text-dashboard-light font-semibold mb-1"
                            >
                              Phone
                            </label>
                            <Field
                              name="phone"
                              type="text"
                              placeholder="Enter your exact phone number"
                              className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted"
                              autoComplete="tel"
                            />
                            <ErrorMessage
                              name="phone"
                              component="span"
                              className="text-xs font-poppins text-dashboard-danger"
                            />
                          </div>

                          {/* OR Separator */}
                          <div className="flex items-center justify-center">
                            <div className="flex-1 border-t border-dashboard"></div>
                            <span className="px-4 text-sm font-medium text-dashboard-light bg-dashboard-sidebar">OR</span>
                            <div className="flex-1 border-t border-dashboard"></div>
                          </div>

                          {/* Email Field */}
                          <div className="flex flex-col gap-2">
                            <label
                              htmlFor="email"
                              className="block text-sm font-poppins text-dashboard-light font-semibold mb-1"
                            >
                              Email
                            </label>
                            <Field
                              name="email"
                              type="email"
                              placeholder="Enter your email address"
                              className="w-full placeholder:text-dashboard-muted outline-none px-3 py-2 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted"
                              autoComplete="email"
                            />
                            <ErrorMessage
                              name="email"
                              component="span"
                              className="text-xs font-poppins text-dashboard-danger"
                            />
                          </div>

                          {/* OR Separator */}
                          <div className="flex items-center justify-center">
                            <div className="flex-1 border-t border-dashboard"></div>
                            <span className="px-4 text-sm font-medium text-dashboard-light bg-dashboard-sidebar">OR</span>
                            <div className="flex-1 border-t border-dashboard"></div>
                          </div>

                          {/* Address Field */}
                          <div className="flex flex-col gap-2">
                            <AddressInput
                              type="address"
                              label="Address"
                              value={(values.address as string) || ""}
                              onChange={(value: string) => setFieldValue("address", value)}
                              placeHolder="Enter your address"
                            />
                            {errors.address && touched.address && (
                              <span className="text-xs font-poppins text-dashboard-danger">
                                {errors.address}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          variant="primary"
                          btnText="Search explorers Account"
                          disabled={loading || isSubmitting}
                          className="w-full"
                        />

                        {/* Help Links */}
                        <div className="flex flex-col items-center gap-2 mt-2">
                          <div className="flex justify-center items-center gap-1">
                            <p className="text-xs text-dashboard-light">Don't have a explorers account?</p>
                            <a href="/register" className="text-dashboard-accent underline text-xs">
                              Register
                            </a>
                          </div>
                          <div className="flex justify-center items-center gap-1">
                            <p className="text-xs text-dashboard-light">Already know your credentials?</p>
                            <a href="/login" className="text-dashboard-accent underline text-xs">
                              Login
                            </a>
                          </div>
                        </div>
                      </Form>
                    )}
                  </Formik>
                </div>
              </div>
            </div>
          ) : currentStep === 1 ? (
            <div className="flex justify-center">
              <div className="w-full max-w-full sm:max-w-lg">
                <PlaceProfileCard
                  profile={foundProfile}
                  onClaim={handleClaimPlace}
                  onBack={handleBackToSearch}
                  showVerifyButton={true}
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-full max-w-full sm:max-w-md">
                <VerificationForm
                  initialValues={verificationData}
                  validationSchema={verificationValidationSchema}
                  onSubmit={handleVerificationSubmit}
                  submitButtonLabel="Submit Verification"
                  heading="Verify Yourself"
                  description="Please provide your contact details and upload a verification document to claim this place"
                  isLoading={verifyLoading}
                  onBack={handleBackToProfile}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ClaimAccount;
