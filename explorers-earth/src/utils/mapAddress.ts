import { AddressComponent, AddressResult } from "../features/Profile/types/types";


export function mapAddressComponents(
  components: AddressComponent[] | undefined
): AddressResult {
  if (!Array.isArray(components)) {
    console.error("Invalid components input", components);
    return {};
  }



  const typeToKey: Record<string, keyof AddressResult> = {
    sublocality: "street_name",
    locality: "city",
    administrative_area_level_1: "state",
    administrative_area_level_2: "administrative_area",
    country: "country",
    postal_code: "postal_code",
  };

  const result = components.reduce<AddressResult>((result, component) => {
    component.types.forEach((type) => {
      const key = typeToKey[type];
      if (key && !result[key]) {
        result[key] = component.long_name;
      }
    });
    return result;
  }, {});

  // Handle postal code more comprehensively
  // Google API can return postal codes with different types
  if (!result.postal_code) {
    const postalCodeComponent = components.find(component =>
      component.types.some(type => 
        type.includes('postal_code') || 
        type === 'postal_code_prefix' || 
        type === 'postal_code_suffix'
      )
    );
    
    if (postalCodeComponent) {
      result.postal_code = postalCodeComponent.long_name;
    }
  }

  // Also handle street name more comprehensively
  if (!result.street_name) {
    const streetComponent = components.find(component =>
      component.types.some(type => 
        type === 'route' || 
        type === 'street_number' || 
        type === 'sublocality_level_1' ||
        type === 'sublocality_level_2' ||
        type === 'neighborhood'
      )
    );
    
    if (streetComponent) {
      result.street_name = streetComponent.long_name;
    }
  }

  return result;
}
