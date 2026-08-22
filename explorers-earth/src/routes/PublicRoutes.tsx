import type { ReactElement } from "react";
import { Route } from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout";
import { PublicProfileFallbackRedirect } from "./PublicProfileFallbackRedirect";
import { publicRouteContract, type PublicRouteId } from "./publicRouteContract";
import { publicRouteLeafComponents } from "./publicRouteLeaves";
import { assertPublicRouteLeafAssembly } from "./publicRouteLeafIdentity";
import TabVisibilityGuard from "./validators/TabVisibilityGuard";
import { UsernameValidator } from "./validators/UsernameValidator";

const publicRouteElements = Object.fromEntries(
  Object.entries(publicRouteLeafComponents).map(([id, Component]) => [id, <Component />]),
) as Record<PublicRouteId, ReactElement>;

function withVisibilityGuard(route: (typeof publicRouteContract)[number]): ReactElement {
  const element = assertPublicRouteLeafAssembly(route.marker, publicRouteElements[route.id]);

  const guardedElement = (() => {
    if (route.visibility === "always-visible") return element;

    const visibilityField = "visibilityField" in route ? route.visibilityField : undefined;
    const defaultVisible = "defaultVisible" in route ? route.defaultVisible : undefined;

    if (!visibilityField) {
      throw new Error(`Guarded public route ${route.id} requires a visibility field`);
    }

    return (
      <TabVisibilityGuard tabField={visibilityField} defaultVisible={defaultVisible}>
        {element}
      </TabVisibilityGuard>
    );
  })();

  return guardedElement;
}

const PublicRoutes = [
  <Route key="public-routes" path=":username/*" element={<PublicLayout />}>
    <Route element={<UsernameValidator />}>
      {publicRouteContract.map((route) => (
        <Route
          key={route.id}
          id={route.id}
          index={"index" in route && route.index}
          path={"index" in route && route.index ? undefined : route.path}
          element={withVisibilityGuard(route)}
        />
      ))}
      <Route path="*" element={<PublicProfileFallbackRedirect />} />
    </Route>
  </Route>,
];

export default PublicRoutes;
