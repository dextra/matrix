import React from "react";
import PropTypes from "prop-types";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const LOGO = "https://storage.googleapis.com/dexmatrix-public/images/logo-dextra.png";

const useStyles = makeStyles(() => ({
  title: {
    flexGrow: 1,
    filter: 'drop-shadow(5px 5px 2px #222)'
  },
  logo: {
    width: 120,
    marginTop: -2,
    marginRight: 16,
    filter: 'drop-shadow(5px 5px 2px #222)'
  }
}));

const AppBarTitle = ({ children }) => {
  const classes = useStyles();

  return (
    <>
      <img className={classes.logo} src={LOGO} />
      <Typography variant="h6" className={classes.title} color="secondary">
        {children}
      </Typography>
    </>
  );
};

AppBarTitle.propTypes = {
  children: PropTypes.node
};

AppBarTitle.defaultProps = {
  children: undefined
};

export default AppBarTitle;
