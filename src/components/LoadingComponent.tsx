import { Backdrop, CircularProgress } from "@mui/material";
import PropTypes from "prop-types";

const LoadingComponent = ({ loading }) => {
  return (
    <div>
      {
        loading && (
          <Backdrop
            sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={open}
          >
            <CircularProgress color="inherit" />
          </Backdrop>
        )
        /* (
        <div className="progress-container">
          <CircularProgress color="info" size={50} />
        </div>
      )*/
      }
    </div>
  );
};

LoadingComponent.propTypes = {
  loading: PropTypes.bool.isRequired,
};
export default LoadingComponent;
