import { DocumentScanner } from '@mui/icons-material'
import { AppBar, Button, Dialog, DialogContent, IconButton, Toolbar, Typography } from '@mui/material'
import React, { useContext, useEffect, useState } from 'react'
import { AdssInterface, AdssPosteInterface, CiudadInterface, EventoInterface, EventoObsInterface, MaterialInterface, ObsInterface, PropietarioInterface, ReporteInterface, TipoObsInterface } from '../../../interfaces/interfaces';
import { SesionContext } from '../../../context/SesionProvider';
import { getReporteTramo } from '../../../api/reporte.api';
import { useSnackbar } from 'notistack';
import { getAdss } from '../../../api/Adss.api';
import { getMaterial } from '../../../api/Material.api';
import { getPropietario } from '../../../api/Propietario.api';
import { getObs } from '../../../api/Obs.api';
import { getTipoObs } from '../../../api/TipoObs.api';
import { DataGridPremium, GridCloseIcon, GridColDef, GridColumnGroupingModel, GridColumnNode, GridExceljsProcessInput, GridToolbar } from '@mui/x-data-grid-premium';
import { getCiudad } from '../../../api/Ciudad.api';


interface ReporteTramoDialogProps {
    filtro: ReporteInterface;

}

const ReporteTramoDialog: React.FC<ReporteTramoDialogProps> = ({ filtro }) => {

    const [open, setOpen] = useState(false);
    const [columns, setColumns] = useState<GridColDef[]>([]);
    const [columnsGrouping, setColumnsGrouping] = useState<GridColumnGroupingModel>([]);

    const [list, setList] = useState<EventoInterface[]>([]);

    const { sesion } = useContext(SesionContext);
    const { enqueueSnackbar } = useSnackbar();

    const [listAdss, setListAdss] = React.useState<AdssInterface[]>([]);
    const [listCiudad, setListCiudad] = React.useState<CiudadInterface[]>([]);

    const [listMaterial, setListMaterial] = React.useState<MaterialInterface[]>([]);
    const [listPropietario, setListPropietario] = React.useState<PropietarioInterface[]>([]);
    const [listObs, setListObs] = React.useState<ObsInterface[]>([]);
    const [listTipoObs, setListTipoObs] = React.useState<TipoObsInterface[]>([]);


    useEffect(() => {
        recibirDatos()
    }, [])

    useEffect(() => {
        const nuevaColumn = [];
        const nuevaColumnGrouping = [];
        let nuevaColumnGroupingTemp: GridColumnNode[] = [];

        nuevaColumn.push({
            field: 'id', headerName: 'Poste',
            /* @ts-expect-error No se sabe el tipo de event*/
            valueGetter(_params, row) { return row.poste.name; }
        })

        listPropietario.map((propietario: PropietarioInterface) => {
            nuevaColumnGroupingTemp.push({ field: propietario.name });
            nuevaColumn.push({
                field: propietario.name, headerName: propietario.name, type: 'boolean',
                /* @ts-expect-error No se sabe el tipo de event*/
                valueGetter(_params, row) {

                    if (row.poste.propietario.id === propietario.id) {
                        return true
                    }
                }
            },)
        })

        nuevaColumnGrouping.push({
            headerClassName: 'propietario-column',

            groupId: 'Propietario',
            children: nuevaColumnGroupingTemp,
        })
        nuevaColumnGroupingTemp = []

        listMaterial.map((material: MaterialInterface) => {
            nuevaColumnGroupingTemp.push({ field: material.name });
            nuevaColumn.push({
                field: material.name, headerName: material.name, type: 'boolean',
                /* @ts-expect-error No se sabe el tipo de event*/
                valueGetter(_params, row) {
                    if (row.poste.material.id === material.id) {
                        return true
                    }
                }
            },)
        })

        nuevaColumnGrouping.push({
            groupId: 'Material',
            children: nuevaColumnGroupingTemp,
        })
        nuevaColumnGroupingTemp = []

        listAdss.map((adss: AdssInterface) => {
            nuevaColumnGroupingTemp.push({ field: adss.name });
            nuevaColumn.push({
                field: adss.name, headerName: adss.name, type: 'boolean',
                /* @ts-expect-error No se sabe el tipo de event*/
                valueGetter(_params, row) {
                    const tempAdssPoste: [] = row.poste.adsspostes.filter((adssposte: AdssPosteInterface) => adssposte.id_adss === adss.id)
                    if (tempAdssPoste.length > 0) {
                        return true
                    }

                }
            },)
        })

        nuevaColumnGrouping.push({
            groupId: 'Adss',
            children: nuevaColumnGroupingTemp,
        })
        nuevaColumnGroupingTemp = []

        nuevaColumn.push({
            field: 'lat', headerName: 'Latitud',
            /* @ts-expect-error No se sabe el tipo de event*/
            valueGetter(_params, row) { return row.poste.lat; }
        })
        nuevaColumnGroupingTemp.push({ field: 'lat' });

        nuevaColumn.push({
            field: 'lng', headerName: 'Longitud',
            /* @ts-expect-error No se sabe el tipo de event*/
            valueGetter(_params, row) { return row.poste.lng }
        })
        nuevaColumnGroupingTemp.push({ field: 'lng' });

        nuevaColumnGrouping.push({
            groupId: 'Coordenadas',
            children: nuevaColumnGroupingTemp,
        })
        nuevaColumnGroupingTemp = []

        listObs.map((obs: ObsInterface) => {
            nuevaColumnGroupingTemp.push({ field: obs.name });

            nuevaColumn.push({
                field: obs.name, headerName: obs.name, type: 'boolean',
                /* @ts-expect-error No se sabe el tipo de event*/
                valueGetter(_params, row) {
                    const tempEventoObs: [] = row.eventoObs.filter((adssposte: EventoObsInterface) => adssposte.id_obs === obs.id)
                    if (tempEventoObs.length > 0) {
                        return true
                    }

                }
            })
        })
        nuevaColumnGrouping.push({
            groupId: 'Observaciones',
            children: nuevaColumnGroupingTemp,
        })
        setColumnsGrouping(nuevaColumnGrouping)
        setColumns(nuevaColumn)

    }, [listTipoObs])

    const recibirDatos = async () => {
        setListAdss(await getAdss(sesion.token))
        setListCiudad(await getCiudad(sesion.token))
        setListMaterial(await getMaterial(sesion.token))
        setListPropietario(await getPropietario(sesion.token))
        setListObs(await getObs(sesion.token))
        setListTipoObs(await getTipoObs(sesion.token))
    }



    const handleClickOpen = async () => {

        if (filtro.TramoInicial && filtro.TramoFinal && filtro.TramoInicial != filtro.TramoFinal) {
            const Temp = await getReporteTramo(filtro, sesion.token)
            if (Temp.length > 0) {
                setList(Temp),
                    setOpen(true);
            } else {
                enqueueSnackbar("No hay datos", {
                    variant: "warning",
                });
            }
        }
        else {
            enqueueSnackbar("Selecciona ciudades diferentes", {
                variant: "warning",
            });
        }
    };

    const handleClose = () => {
        setOpen(false);
    };


    const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
        // Set document meta data
        workbook.creator = 'Lefitel';
        workbook.created = new Date();
        // Customize default excel properties
        worksheet.properties.defaultRowHeight = 30;

        // Create a custom file header
        //worksheet.mergeCells('A1:A4');
        worksheet.getCell("A3").value = ""
        //worksheet.getCell('A1').value = 'Reporte Por tramo';

        /* worksheet.getCell('A1').border = {
             bottom: { style: 'medium', color: { argb: 'FF007FFF' } },
         };*/


        /*
                worksheet.getCell('A1').font = {
                    name: 'Arial Black',
                    size: 20,
                };
                worksheet.getCell('A1').alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true,
                };*/
        worksheet.addRow([]);
    };
    const exceljsPostProcess = ({ worksheet }: GridExceljsProcessInput) => {
        // add a text after the data
        worksheet.addRow({}); // Add empty row
        worksheet.name = 'Reporte';



        let lastRow = 0;
        let lastCol = 0;
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            lastRow = Math.max(lastRow, rowNumber);
            row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
                lastCol = Math.max(lastCol, colNumber);
            });
        });

        for (let i = 7; i <= lastRow; i++) {
            const fila = worksheet.getRow(i);
            fila.height = 15;
        }


        worksheet.mergeCells(1, 1, 1, lastCol);
        worksheet.mergeCells(2, 1, 2, 5);
        worksheet.mergeCells(2, 6, 2, lastCol);
        worksheet.mergeCells(3, 1, 3, 5);
        worksheet.mergeCells(3, 6, 3, lastCol);
        worksheet.mergeCells(4, 1, 4, lastCol);

        worksheet.getCell('A1').value = 'PLANILLA DE EVENTOS';
        worksheet.getCell('A2').value = 'Tramo: ';

        worksheet.getCell('A3').value = 'Fecha: ';
        worksheet.getCell('A4').value = 'Lefitel';
        worksheet.getCell('F3').value = filtro.fechaInicial?.toLocaleDateString() + ' - ' + filtro.fechaFinal?.toLocaleDateString();
        worksheet.getCell('F2').value = listCiudad?.find(objeto => objeto.id === filtro.TramoInicial)?.name + " - " + listCiudad?.find(objeto => objeto.id === filtro.TramoFinal)?.name;

        ['A2', 'A3', 'A4', 'F2', 'F3', 'F4'].map(key => {
            worksheet.getCell(key).font = {
                bold: true,
                size: 15,
            };
        });


        worksheet.getCell('A1').font = {
            bold: true,
            size: 20,
        };

        worksheet.getRow(6).eachCell(function (cell) {
            if (cell.value != "Latitud" && cell.value != "Longitud") {
                cell.alignment = { textRotation: 90 };
            }
        });

        worksheet.columns.forEach((column) => {
            column.width = 5 // Ajusta el ancho mínimo de la columna
        });

        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            lastRow = Math.max(lastRow, rowNumber);
            row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
                lastCol = Math.max(lastCol, colNumber);
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true,
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (cell.value === "Latitud" || cell.value === "Longitud") {
                    worksheet.getColumn(colNumber).width = 10;
                }


                switch (cell.value) {
                    case 'Material':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE06666' } // Rojo
                        };
                        break;
                    case 'Propietario':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF6FA8DC' } // Rojo
                        }; break;
                    case 'Adss':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFe2ac3f' } // Rojo
                        }; break;
                    case 'Coordenadas':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFf8ebbe' } // Rojo
                        }; break;
                    case 'Observaciones':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF7ba58d' } // Rojo
                        }; break;
                    default:
                }
                if (cell.value === true) {
                    cell.value = "1";
                }
            });
        });

        worksheet.getRow(5).eachCell(function (cell) {
            cell.font = { bold: true, size: 13, };
        });
        worksheet.getRow(6).eachCell(function (cell) {
            cell.font = { bold: true };
        });


        //worksheet.addRow(['Lefitel']);
    };

    const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte por tramo " + new Date().toLocaleDateString() };


    return (
        <React.Fragment>
            <Button startIcon={<DocumentScanner />} onClick={handleClickOpen}>
                {"Generar Reporte"}
            </Button>
            <Dialog
                fullScreen
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={handleClose}
                            aria-label="close"
                        >
                            <GridCloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {"Reporte Por Tramo"}
                        </Typography>

                    </Toolbar>
                </AppBar>
                <DialogContent sx={{

                    /*'& .propietario-column': {
                        backgroundColor: 'rgba(255, 7, 0, 0.55)',
                    },*/
                }}>


                    <DataGridPremium
                        //className="datagrid-content"
                        rows={list ? list : []}
                        columns={columns}
                        slots={{
                            toolbar: GridToolbar
                        }}
                        hideFooterPagination
                        rowHeight={35}
                        disableRowSelectionOnClick
                        hideFooter
                        columnGroupingModel={columnsGrouping}
                        slotProps={{ toolbar: { excelOptions } }}
                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    )
}

export default ReporteTramoDialog