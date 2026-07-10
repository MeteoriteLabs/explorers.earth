import { Field, Form, Formik } from "formik";
import { FC, useState } from "react";
import Button from "../../../components/ui/Button";
import { KeyValuePair } from "./RecommendForm";
import * as Yup from "yup";
import AddressInput from "../../Profile/components/AddressInput";
import { Places } from "../../Profile/types/types";
import useAuthStore from "../../../store/store";
import { getCurrentDomain } from "../../../utils/getCurrentDomain";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// types for form field
interface FormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
  as?: string;
}

interface ListFormProps {
  isEditing: boolean;
  initialValues: KeyValuePair;
  validationSchema: Yup.AnySchema;
  onSubmit: (values: KeyValuePair) => void;
  fields: FormField[];
}

const ListForm: FC<ListFormProps> = ({
  isEditing,
  initialValues,
  validationSchema,
  onSubmit,
  fields,
}) => {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<Places | null>();
  const [fetchedListName, setFetchedListName] = useState<string>();
  const handleListNameChange = (
    value: string,
    setFieldValue: (field: string, value: string) => void
  ) => {
    setFetchedListName(value);
    setFieldValue("listName", value);

    // Create a slug from the list name:
    // 1. Convert to lowercase
    // 2. Remove commas
    // 3. Replace multiple spaces with a single hyphen
    const slug = value
      .toLowerCase()
      .replace(/,/g, "") // Remove commas
      .replace(/\s+/g, "-"); // Replace spaces with hyphens

    setFieldValue("placeUrl", slug);
  };
  const { user } = useAuthStore();
  const url = getCurrentDomain();

  return (
    <div className="white-theme">
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={(values) => {
          const updatedRecommendationValues = {
            ...values,
            listName: places?.name,
            placeId: places?.place_id,
          };

          if (!places?.name && !isEditing) {
            toast.error(t("toast.error.selectPlaceFromSuggestions"));
          } else {
            onSubmit(updatedRecommendationValues);
          }
        }}
        enableReinitialize
      >
        {({ errors, touched, setFieldValue }) => (
          <Form className="font-poppins flex flex-col gap-2 w-full max-w-3xl">
            {fields.map((field, index) => (
              <div key={index} className="flex flex-col mb-2">
                <label className="flex items-center gap-2 dt-label mb-1">
                  {field.label}
                </label>
                {field.name === "listName" ? (
                  <AddressInput
                    setPlaces={setPlaces}
                    type="listName"
                    label="List Name"
                    initalValue={initialValues.listName}
                    value={fetchedListName}
                    onChange={(value: string) =>
                      handleListNameChange(value, setFieldValue)
                    }
                    placeHolder={field.placeholder}
                  />
                ) : field.name === "placeUrl" ? (
                  <div className="flex w-full md:flex-row flex-col items-center">
                    <label className="w-full dt-label md:font-medium font-poppins">
                      {url}/{user?.username}/
                    </label>
                    <Field
                      disabled={isEditing ? field.name === "placeUrl" : ""}
                      type={field.type}
                      name={field.name}
                      className={`w-full ${
                        isEditing ? "bg-gray-600 cursor-not-allowed text-gray-400" : "bg-gray-700/50 text-white"
                      } placeholder:text-gray-400 outline-none p-3 border border-gray-600 font-poppins rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-cta))] hover:border-[hsl(var(--blue-cta))] focus:bg-gray-700`}
                      placeholder={field.placeholder}
                    />
                  </div>
                ) : (
                  <Field
                    type={field.type}
                    name={field.name}
                    className={`w-full placeholder:text-dashboard-muted outline-none p-3 border border-dashboard bg-dashboard-muted font-poppins rounded-md text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent focus:bg-dashboard-muted`}
                    placeholder={field.placeholder}
                  />
                )}

                {errors[field.name] && touched[field.name] && (
                  <span className="dt-subtext text-dashboard-danger">
                    {errors[field.name] as string}
                  </span>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                type="submit"
                btnText={`${
                  isEditing
                    ? t(
                        "dashboard.recommendations.locationForm.buttons.updateLocation"
                      )
                    : t(
                        "dashboard.recommendations.locationForm.buttons.addLocation"
                      )
                }`}
                variant="primary"
              />
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ListForm;
