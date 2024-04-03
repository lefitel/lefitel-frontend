import { Grid } from "@mui/material";

import ReportGeneralSec from "./reportes/ReportGeneralSec";
import ReportTramoSec from "./reportes/ReportTramoSec";
import ReportRecorridoSec from "./reportes/ReportRecorrido";

const ReportePage = () => {



  return <Grid
    container
    sx={{
      minHeight: { xs: "calc(100vh - 64px)" },
      alignItems: "stretch",
      margin: 0,
    }}
  >
    <Grid item xs={12} md={6} sx={{ padding: 0 }}>
      <Grid >
        <ReportGeneralSec />
      </Grid>

      <Grid >
        <ReportRecorridoSec />
      </Grid>
    </Grid>
    <Grid item xs={12} md={6} sx={{ padding: 0 }}>
      <Grid >
        <ReportTramoSec />
      </Grid>
    </Grid>
  </Grid>

    ;
};

export default ReportePage;
