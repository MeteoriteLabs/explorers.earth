import { FC, memo } from "react";
import Card from "../../../components/ui/Card";
import DeleteIcon from "../../../assets/icons/DeleteIcon";
import EditIcon from "../../../assets/icons/EditIcon";
import DraftIcon from "../../../assets/icons/DraftIcon";
import EarthIcon from "../../../assets/icons/EarthIcon";
import type { Guide } from "../types";

interface GuideCardProps {
  guide: Guide;
  onClickHandler: (documentId: string) => void;
  onEdit: (documentId: string) => void;
  onDelete: (documentId: string) => void;
  onToggleVisibility?: (documentId: string, currentVisibility: boolean) => void;
}

const GuideCard: FC<GuideCardProps> = memo(
  ({ guide, onClickHandler, onEdit, onDelete, onToggleVisibility }) => {
    // Get image from Guide_Media
    const coverImage =
      guide.Guide_Media?.[0]?.url || "https://placehold.co/400x400";

    // Parse Place_Details if it's a string
    let placeDetails: any = {};
    if (guide.Place_Details) {
      if (typeof guide.Place_Details === "string") {
        try {
          placeDetails = JSON.parse(guide.Place_Details);
        } catch (error) {
          console.error("Error parsing Place_Details:", error);
        }
      } else {
        placeDetails = guide.Place_Details;
      }
    }

    // Get rating and reviews for display
    const rating = placeDetails.Rating;
    const reviews = placeDetails.Rating_Count;

    // Extract location tags based on single vs multi-city
    const getLocationTags = (): string[] => {
      if (!placeDetails || Object.keys(placeDetails).length === 0) {
        return [];
      }

      // Check if it's multi-city format
      if (
        placeDetails.isMultiCity === true &&
        ((placeDetails.ending || placeDetails.arrival || placeDetails.to) &&
          (placeDetails.starting || placeDetails.departure || placeDetails.from))
      ) {
        const cities: string[] = [];

        // Add starting city
        const starting = placeDetails.starting || placeDetails.departure || placeDetails.from;
        if (starting?.Place_Name) {
          cities.push(starting.Place_Name);
        } else if (starting?.Place_Address) {
          cities.push(starting.Place_Address);
        }

        // Add intermediate cities
        const intermediateCities = placeDetails.intermediateCities || [];
        intermediateCities.forEach((city: any) => {
          if (city.Place_Name) {
            cities.push(city.Place_Name);
          } else if (city.Place_Address) {
            cities.push(city.Place_Address);
          }
        });

        // Add ending city
        const ending = placeDetails.ending || placeDetails.arrival || placeDetails.to;
        if (ending?.Place_Name) {
          cities.push(ending.Place_Name);
        } else if (ending?.Place_Address) {
          cities.push(ending.Place_Address);
        }

        return cities;
      } else {
        // Single city format
        const locationName = placeDetails.Place_Name || placeDetails.Place_Address;
        return locationName ? [locationName] : [];
      }
    };

    const locationTags = getLocationTags();

    return (
      <Card
        cardType="menuCard"
        menuItems={[
          {
            icon: guide.Visibility ? <DraftIcon stroke="currentColor" size="4" /> : <EarthIcon stroke="currentColor" size="4" />,
            label: guide.Visibility ? "Make Draft" : "Make Public",
            action: () => onToggleVisibility && onToggleVisibility(guide.documentId, !!guide.Visibility),
          },
          {
            icon: <EditIcon />,
            label: "Edit",
            action: () => onEdit(guide.documentId),
          },
          {
            icon: <DeleteIcon stroke="red" />,
            label: "Delete",
            action: () => onDelete(guide.documentId),
          },
        ]}
        onClickhandler={() => onClickHandler(guide.documentId)}
        image={coverImage}
        title={guide.Title}
        rating={rating}
        reviews={reviews}
        numberOfDays={guide.Number_Of_Days || null}
        locationTags={locationTags}
        visibility={guide.Visibility}
      />
    );
  }
);

GuideCard.displayName = "GuideCard";

export default GuideCard;
