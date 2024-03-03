import { Add, Close } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Slide,
  Toolbar,
  Typography,
} from "@mui/material";
import React from "react";
import PropTypes from "prop-types";

export const TransitionDialog = React.forwardRef(function Transition(
  props,
  ref
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const SimpleDialogComponent = ({ label, icon, content, title }) => {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button startIcon={icon} variant="outlined" onClick={handleClickOpen}>
        {label}
      </Button>
      <Dialog
        fullWidth
        keepMounted
        open={open}
        onClose={handleClose}
        TransitionComponent={TransitionDialog}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{content} </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Ok</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
SimpleDialogComponent.propTypes = {
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,

  icon: PropTypes.element.isRequired,
  content: PropTypes.element.isRequired,
};
export default SimpleDialogComponent;
