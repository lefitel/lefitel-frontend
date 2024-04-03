import { Card, CardContent, Grid } from "@mui/material"
import EditUserNameDialog from "../../components/dialogs/edits/EditUserNameDialog";
import EditUserPassDialog from "../../components/dialogs/edits/EditUserPassDialog";

const AjustePage = () => {
  return (<Grid
    container
    sx={{
      height: { xs: "auto", md: "calc(100vh - 64px)" },
      alignItems: "stretch",
    }}
  >
    <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
      <Card style={{}}>
        <CardContent style={{ display: "grid", gap: "8px", justifyContent: "center" }}>
          <EditUserNameDialog />
          <EditUserPassDialog />
        </CardContent>
      </Card>
    </Grid>


  </Grid>
  )
};

export default AjustePage;
