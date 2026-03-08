import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Home from "../assets/icons/Home";

const PageNotFound = memo(() => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex font-poppins items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="relative w-full max-w-md mx-auto">
        <motion.div
          className="backdrop-blur-sm bg-gray-900/80 border border-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h1
            className="text-6xl sm:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple to-purple-500 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            404
          </motion.h1>

          <motion.h2
            className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple to-purple-500 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Page Not Found
          </motion.h2>

          <motion.p
            className="text-sm sm:text-base text-gray-400 mt-2 sm:mt-3 mb-6 sm:mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            The page you're looking for doesn't exist or has been moved.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center"
          >
            <Button
              btnText="Go Home"
              variant="primary"
              size="medium"
              startIcon={<Home />}
              onClickHandler={() => navigate("/")}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});

export default PageNotFound;

