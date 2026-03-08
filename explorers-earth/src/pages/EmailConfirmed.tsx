import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const EmailConfirmed = () => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-theme min-h-screen flex font-poppins items-center justify-center bg-dashboard-bg text-dashboard px-4 sm:px-6 py-6 sm:py-10">
      <div className="relative w-full max-w-md mx-auto">
        <motion.div
          className="bg-dashboard-sidebar border border-dashboard p-6 sm:p-8 rounded-2xl shadow-dashboard-elevated text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h2
            className="text-xl sm:text-2xl font-bold text-dashboard-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Email Verified!
          </motion.h2>

          <p className="text-sm sm:text-base text-dashboard-light mt-2 sm:mt-3 mb-4 sm:mb-6">
            Your email has been successfully verified. You can now proceed to
            login.
          </p>

          <motion.button
            onClick={() => navigate("/login")}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-medium shadow-lg transition duration-200 text-sm sm:text-base bg-dashboard-accent hover:bg-dashboard-accent/90 text-white"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Go to Login
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default memo(EmailConfirmed);
