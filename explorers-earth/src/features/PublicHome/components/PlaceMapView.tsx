import { AdvancedMarker, Map, MapCameraChangedEvent, Pin } from "@vis.gl/react-google-maps";
import { memo, useState } from "react";
import Button from "../../../components/ui/Button";
import WhiteMap from "../../../assets/icons/WhiteMap";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { getPlaceCoordinatesByListQuery } from "../api/query";
import Card from "../../../components/ui/Card";
import { EarthLoader } from "../../../components/EarthLoader";

type List = {
  recommended_places: {
    Place_Details: {
      Place_Address: string;
      Place_Id: string;
      Place_Name: string;
      Geometry?: {
        lat: number;
        lng: number;
      };
      Rating: number;
      Rating_Count: number;
      Title: string;
    };
    recommendation_category: { Category_Name: string };
    documentId: string;
    Media: {
      url: string;
    }[];
  }[];
};

type Geometry = {
  lat: number;
  lng: number;
};
const PlaceMapView = memo(() => {
  const [currentCoords, setCurrentCoords] = useState<Geometry | null>(null);
  const [activeMarker, setActiveMarker] = useState<Geometry | null>(null);
  // local state for handle catgeories
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const handleCameraChanged = (event: MapCameraChangedEvent) => {
    const { detail } = event;
    setCurrentCoords(detail.center);
  };

  const { username, place } = useParams();
  const { data, loading } = useQuery(getPlaceCoordinatesByListQuery, {
    variables: {
      filters: {
        username: {
          eq: username,
        },
      },
      listFilters: {
        List_Name: {
          eq: place,
        },
      },
    },
  });
  const navigate = useNavigate();

  const latLngArray = data?.accounts?.[0].recommendation_lists.flatMap(
    (list: List) =>
      list?.recommended_places.map((place) => place.Place_Details.Geometry)
  );

  const handleCardClick = (geometry: Geometry) => {
    setCurrentCoords(geometry);
    setActiveMarker(geometry);
  };

  const placeData = data?.accounts?.[0].recommendation_lists.flatMap(
    (list: List) =>
      list?.recommended_places.map((place) => ({
        ...place.Place_Details,
        Media: place.Media,
        category: place.recommendation_category.Category_Name,
      }))
  );

  // fetching categories for the recommendation list
  const categories: string[] = Array.from(
    new Set(placeData?.map((place: { category: string }) => place?.category))
  );

  // Filter the recommended places by the selected category
  const filteredPlaces = selectedCategory
    ? placeData.filter(
      (place: { category: string }) => place?.category === selectedCategory
    )
    : placeData;

  if (loading)
    return (
      <div className="flex bg-black items-center justify-center min-h-screen">
        <EarthLoader context="general" size="small" />
      </div>
    );

  return (
    <div>
      <Map
        defaultCenter={currentCoords ?? latLngArray[0]}
        center={currentCoords}
        defaultZoom={13}
        onCameraChanged={handleCameraChanged}
        mapId={"mapView"}
        style={{ height: "100vh", width: "100%" }}
        scrollwheel={true}
        gestureHandling={"greedy"}
      >
        {latLngArray.map(
          (coords: { lat: number; lng: number }, index: number) => (
            <AdvancedMarker key={index} position={coords}>
              <Pin
                background={
                  activeMarker?.lat === coords.lat &&
                    activeMarker?.lng === coords.lng
                    ? "purple"
                    : "red"
                }
                borderColor={
                  activeMarker?.lat === coords.lat &&
                    activeMarker?.lng === coords.lng
                    ? "3px solid purple"
                    : "red"
                }
                glyphColor={"white"}
              />
            </AdvancedMarker>
          )
        )}
      </Map>
      <div className="absolute bottom-[18rem] w-full  flex flex-row gap-2 items-center flex-nowrap whitespace-nowrap  py-4 overflow-x-auto " style={{ scrollbarWidth: "none" }}>
        {categories && categories.length >= 1 && (
          <div className="px-2 flex gap-3">
            <Button
              btnText={"All"}
              type="button"
              variant={selectedCategory === "" ? "tagSelected" : "tag"}
              onClickHandler={() => setSelectedCategory("")}
              size="xsmall"
            />
            {categories?.map((tag: string, index: number) => (
              <Button
                key={index}
                btnText={tag}
                type="button"
                variant={selectedCategory === tag ? "tagSelected" : "tag"}
                onClickHandler={() => setSelectedCategory(tag)}
                size="xsmall"
              />
            ))}
          </div>
        )}
      </div>
      <div
        className={` absolute bottom-24 left-0 right-0 z-50 p-2 flex gap-4 overflow-x-auto transition-transform duration-300 ease-in-out `}
        style={{ scrollbarWidth: "none" }}
      >
        {filteredPlaces.map(
          (
            place: {
              Title: string;
              Media: { url: string }[];
              Rating: number;
              Rating_Count: number;
              Geometry: Geometry;
            },
            index: number
          ) => (
            <Card
              key={index}
              title={place?.Title}
              image={place?.Media?.[0]?.url}
              rating={place?.Rating}
              reviews={place?.Rating_Count}
              cardType={"map"}
              onClickhandler={() => handleCardClick(place?.Geometry)}
            />
          )
        )}
      </div>
      <div className="fixed bottom-[3.5rem] z-50 md:left-0 flex justify-center w-full">
        <Button
          startIcon={<WhiteMap />}
          btnText="List View"
          variant="primary"
          size="xsmall"
          onClickHandler={() =>
            navigate(`/${username}/places/${place}`)
          }
          className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))]"
        />
      </div>
    </div>
  );
});

export default PlaceMapView;
