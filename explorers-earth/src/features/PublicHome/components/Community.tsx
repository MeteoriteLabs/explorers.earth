
import { usePublicRouteLifecycle } from "../../../layouts/usePublicRouteLifecycle";

const Community = () => {
  usePublicRouteLifecycle({ loading: false });

  return (
    <div>Community</div>
  )
}

export default Community
