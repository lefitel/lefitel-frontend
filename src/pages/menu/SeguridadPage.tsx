
import { useContext, useEffect, useState } from "react";
import { DataGridPremium, GridColDef, GridExceljsProcessInput, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";
import { RolInterface, UsuarioInterface } from "../../interfaces/interfaces";
import { SesionContext } from "../../context/SesionProvider";
import { getUsuario, searchUsuario } from "../../api/Usuario.api";
import { Box, ButtonGroup, Card, CardActions, CardContent, Grid } from "@mui/material";
import AddUserDialog from "../../components/dialogs/add/AddUserDialog";
import { usuarioExample } from "../../data/example";
import EditUserDialog from "../../components/dialogs/edits/EditUserDialog";

const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
  { field: 'lastname', headerName: 'Apellido' },
  { field: 'phone', headerName: 'Telefono' },
  {
    field: 'birthday', headerName: 'Nacimiento', type: 'date',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  { field: 'user', headerName: 'Usuario' },
  {
    field: 'rol', headerName: 'Rol',
    valueGetter: (value: RolInterface) => {
      return value.name;
    }
  },
  {
    field: 'createdAt', headerName: 'Creación', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
];

const SeguridadPage = () => {
  const [openEdit, setOpenEdit] = useState(false);
  const [list, setList] = useState<UsuarioInterface[]>();
  const [data, setData] = useState<UsuarioInterface>(usuarioExample);
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [openEdit])

  const recibirDatos = async () => {
    setList(await getUsuario(sesion.token))
  }

  const userSelect = async (params: GridRowParams) => {
    setOpenEdit(true);
    setData(await searchUsuario(params.row.id, sesion.token))
  }



  const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
    workbook.creator = 'Lefitel';
    workbook.created = new Date();
    worksheet.properties.defaultRowHeight = 30;
    worksheet.getCell("A2").value = ""


    worksheet.addRow([]);
  };
  const exceljsPostProcess = async ({ worksheet }: GridExceljsProcessInput) => {
    worksheet.addRow({});
    worksheet.name = 'Reporte';

    let lastRow = 0;
    let lastCol = 0;
    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      lastRow = Math.max(lastRow, rowNumber);
      row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
        lastCol = Math.max(lastCol, colNumber);
      });
    });

    for (let i = 6; i <= lastRow; i++) {
      const fila = worksheet.getRow(i);
      fila.height = 15;
    }

    worksheet.mergeCells(1, 1, 1, 9);
    worksheet.mergeCells(2, 1, 2, 9);
    worksheet.mergeCells(3, 1, 3, 9);

    worksheet.getCell('A1').value = 'USUARIOS';
    worksheet.getCell('A2').value = 'Lefitel';







    ['A2', 'A3'].map(key => {
      worksheet.getCell(key).font = {
        bold: true,
        size: 15,
      };
    });


    worksheet.getCell('A1').font = {
      bold: true,
      size: 20,
    };
    ['A1', 'A2', 'A3'].map(key => {
      worksheet.getCell(key).alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    });

    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      lastRow = Math.max(lastRow, rowNumber);
      row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
        lastCol = Math.max(lastCol, colNumber);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

      });
    });

    worksheet.getRow(4).eachCell(function (cell) {
      cell.font = { bold: true, size: 13, };
    });


    //worksheet.addRow(['Lefitel']);
  };

  const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte de usuarios del " + new Date().toLocaleDateString() };




  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
        margin: 0,
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} style={{}}>
          <CardActions >
            <ButtonGroup >
              <AddUserDialog functionApp={recibirDatos} />
            </ButtonGroup>
          </CardActions>
          <CardContent style={{}}>
            <Box
              sx={{
                height: {
                  xs: "calc(100vh - 105px)",
                  md: "calc(100vh - 200px)",
                },
                width: {
                  xs: "calc(100vw - 100px)",
                  sm: "calc(100vw - 115px)",
                  md: "calc(100vw - 115px)",
                },
              }}
            >
              <DataGridPremium
                rows={list ? list : []}
                columns={columns}
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                  //loadingOverlay: LinearProgress,
                }}
                onRowClick={userSelect}
                hideFooter
                slotProps={{ toolbar: { excelOptions, showQuickFilter: true } }}

              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditUserDialog functionApp={recibirDatos} user={data} setUser={setData} open={openEdit} setOpen={setOpenEdit} /> : null}
    </Grid>
  );
};

export default SeguridadPage;
