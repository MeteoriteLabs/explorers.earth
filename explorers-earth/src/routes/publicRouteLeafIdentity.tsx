import type { ComponentType, ReactElement } from "react";

type IdentifiedLeaf = ComponentType & {
  readonly publicRouteLeafMarker?: string;
};

export function withPublicRouteLeafIdentity(
  marker: string,
  Component: ComponentType,
): IdentifiedLeaf {
  const PublicRouteLeaf = () => (
    <div className="contents" data-public-route-leaf={marker}>
      <Component />
    </div>
  );
  Object.defineProperty(PublicRouteLeaf, "publicRouteLeafMarker", {
    value: marker,
    enumerable: true,
  });
  PublicRouteLeaf.displayName = `PublicRouteLeaf(${Component.displayName || Component.name || marker})`;
  return PublicRouteLeaf;
}

export function assertPublicRouteLeafAssembly(
  expectedMarker: string,
  element: ReactElement,
): ReactElement {
  const actualMarker = (element.type as IdentifiedLeaf).publicRouteLeafMarker;
  if (actualMarker !== expectedMarker) {
    throw new Error(`PUBLIC_ROUTE_LEAF_MISMATCH:${expectedMarker}:${actualMarker ?? "unidentified"}`);
  }
  return element;
}
