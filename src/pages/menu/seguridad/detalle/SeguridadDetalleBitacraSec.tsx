import {
  Box,
  Card,
  CardContent,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useContext, useEffect, useState } from "react";
import { BitacoraInterface } from "../../../../interfaces/interfaces";
import { getBitacora } from "../../../../api/Bitacora.api";
import { SesionContext } from "../../../../context/SesionProvider";
const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 100 },
  { field: 'description', headerName: 'Descripción', width: 150 },
  { field: 'id_usuario', headerName: 'Usuario', width: 100 },
  {
    field: 'createdAt', headerName: 'Creación', width: 150,
    valueGetter: (params) => {
      const date = new Date(params.row.createdAt);
      return date.toLocaleString();

    }
  },
];

interface SeguridadDetalleBitacoraSecProps {
  userId: number;
}
const SeguridadDetalleBitacoraSec: React.FC<SeguridadDetalleBitacoraSecProps> = ({ userId }) => {
  const [list, setList] = useState<BitacoraInterface[]>();
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [])

  const recibirDatos = async () => {
    setList(await getBitacora(userId, sesion.token))
  }

  return (
    <Card sx={{ flex: 1 }}>
      <CardContent>
        <Box
          sx={{
            height: {
              xs: "250px",
            },
            width: {
              xs: "calc(100vw - 100px )",
              sm: "calc(100vw - 115px )",
              md: "calc(100vw - 150px )",
            },
          }}
        >
          <DataGrid
            //className="datagrid-content"
            rows={list ? list : []}
            columns={columns}
            experimentalFeatures={{ lazyLoading: true }}
            rowsLoadingMode="server"
            hideFooterPagination
            rowHeight={38}
            disableRowSelectionOnClick

            hideFooter
          />
        </Box>
      </CardContent>


    </Card>
  );
};


export default SeguridadDetalleBitacoraSec;
