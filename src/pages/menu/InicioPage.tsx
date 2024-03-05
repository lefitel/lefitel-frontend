import { Add, WhereToVote } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  Typography,
} from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import React, { useEffect } from "react";
import {
  columnsData,
  markersData,
  pData,
  rowsData,
  timeData,
  uData,
} from "../../data/example";
import { DataGrid } from "@mui/x-data-grid";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { getAdss } from "../../api/Adss.api";

const InicioPage = () => {
  useEffect(() => {
    //getAdss();
  }, []);

  return (
    <Grid container alignItems={"stretch"} className="evento-page">
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <Card
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          variant="outlined"
        >
          <CardContent
            style={{ display: "flex", flexDirection: "column", flex: 1 }}
          >
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Pendientes
            </Typography>

            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h1"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                513
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                postes
              </Typography>
            </Grid>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            ></Typography>
            <CardActions style={{ padding: 0 }}>
              <Button fullWidth startIcon={<Add />} variant="contained">
                solucionar
              </Button>
              <Button fullWidth startIcon={<Add />} variant="contained">
                añadir
              </Button>
            </CardActions>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        <Card variant="outlined">
          {" "}
          <CardContent>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Histórico
            </Typography>
            <hr />
            <LineChart
              height={300}
              series={[
                { data: pData, label: "pv", id: "pvId" },
                { data: uData, label: "uv", id: "uvId" },
              ]}
              xAxis={[
                {
                  scaleType: "time",
                  data: timeData,
                  min: timeData[0].getTime(),
                  max: timeData[timeData.length - 1].getTime(),
                },
              ]}
              sx={{
                ".MuiLineElement-root, .MuiMarkElement-root": {
                  strokeWidth: 1,
                },
                ".MuiLineElement-series-pvId": {
                  strokeDasharray: "5 5",
                },
                ".MuiLineElement-series-uvId": {
                  strokeDasharray: "3 4 5 2",
                },
                ".MuiMarkElement-root:not(.MuiMarkElement-highlighted)": {
                  fill: "#fff",
                },
                "& .MuiMarkElement-highlighted": {
                  stroke: "none",
                },
              }}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card variant="outlined" style={{}}>
          <CardContent style={{}}>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Detalle
            </Typography>
            <Box sx={{ width: 1 }}>
              <DataGrid
                rowHeight={34}
                rows={rowsData}
                columns={columnsData}
                initialState={{
                  pagination: {
                    paginationModel: {
                      pageSize: 7,
                    },
                  },
                }}
                pageSizeOptions={[7]}
                checkboxSelection
                disableRowSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card variant="outlined">
          {" "}
          <CardContent>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Eventos Pendientes en mapa
            </Typography>
          </CardContent>
          <CardActions>
            <Button size="small">Learn More</Button>
          </CardActions>
        </Card>
      </Grid>
    </Grid>
  );
};

export default InicioPage;
