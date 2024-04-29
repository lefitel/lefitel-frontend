import { DocumentScanner } from '@mui/icons-material'
import { AppBar, Box, Button, CircularProgress, Dialog, DialogContent, IconButton, Toolbar, Typography } from '@mui/material'
import React, { useContext, useEffect, useState } from 'react'
import { AdssInterface, AdssPosteInterface, EventoInterface, EventoObsInterface, MaterialInterface, ObsInterface, PropietarioInterface, ReporteInterface, TipoObsInterface } from '../../../interfaces/interfaces';
import { SesionContext } from '../../../context/SesionProvider';
import { getReporteTramo } from '../../../api/reporte.api';
import { useSnackbar } from 'notistack';
import { getAdss } from '../../../api/Adss.api';
import { getMaterial } from '../../../api/Material.api';
import { getPropietario } from '../../../api/Propietario.api';
import { getObs } from '../../../api/Obs.api';
import { getTipoObs } from '../../../api/TipoObs.api';
import { DataGridPremium, GridCloseIcon, GridColDef, GridColumnGroupingModel, GridColumnNode, GridExceljsProcessInput, GridToolbar } from '@mui/x-data-grid-premium';


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
    const [cargando, setCargando] = useState(false);

    const [listAdss, setListAdss] = React.useState<AdssInterface[]>([]);
    //const [listCiudad, setListCiudad] = React.useState<CiudadInterface[]>([]);

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
        //setListCiudad(await getCiudad(sesion.token))
        setListMaterial(await getMaterial(sesion.token))
        setListPropietario(await getPropietario(sesion.token))
        setListObs(await getObs(sesion.token))
        setListTipoObs(await getTipoObs(sesion.token))
    }



    const handleClickOpen = async () => {
        setCargando(true)
        console.log(filtro)
        const Temp = await getReporteTramo(filtro, sesion.token)
        if (Temp.length > 0) {
            setList(Temp)
            setOpen(true)
        } else {
            enqueueSnackbar("No hay datos", {
                variant: "warning",
            });
        }
        await setCargando(false)

    };

    const handleClose = () => {
        setOpen(false);
    };

    const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
        setCargando(true)
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

    const exceljsPostProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
        console.log("Cargando")
        // add a text after the data
        worksheet.addRow({}); // Add empty row
        worksheet.name = 'Reporte General';

        //Gneral
        let lastRow = 0;
        let lastCol = 0;
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            lastRow = Math.max(lastRow, rowNumber);
            row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
                lastCol = Math.max(lastCol, colNumber);
            });
        });

        const map = new Map(); // Usamos un mapa para almacenar los arrays por pares únicos
        list.forEach(obj => {
            const clave = `${obj.poste?.ciudadA?.id}-${obj.poste?.ciudadB?.id}`; // Creamos una clave única para el par de datos
            if (!map.has(clave)) {
                map.set(clave, []); // Creamos un nuevo array si es la primera vez que encontramos este par
            }
            map.get(clave).push(obj); // Agregamos el objeto al array correspondiente
        });
        const datos: EventoInterface[][] = Array.from(map.values());




        for (let i = 7; i <= lastRow; i++) {
            const fila = worksheet.getRow(i);
            fila.height = 15;
        }


        worksheet.mergeCells(1, 1, 1, lastCol);
        worksheet.mergeCells(2, 1, 2, 5);
        worksheet.mergeCells(2, 6, 2, lastCol);
        worksheet.mergeCells(3, 1, 3, 5);
        worksheet.mergeCells(3, 6, 3, lastCol);
        worksheet.mergeCells(4, 1, 4, 5);
        worksheet.mergeCells(4, 6, 4, lastCol);


        worksheet.getCell('A1').value = 'PLANILLA DE EVENTOS NACIONAL';
        worksheet.getCell('A2').value = 'Tramo: ';

        worksheet.getCell('A3').value = 'Fecha: ';
        worksheet.getCell('A4').value = 'Elaborado por:';

        worksheet.getCell('F2').value = "Total";
        worksheet.getCell('F3').value = filtro.fechaInicial?.toLocaleDateString() + ' - ' + filtro.fechaFinal?.toLocaleDateString();
        worksheet.getCell('F4').value = "Lefitel";

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


        worksheet.columns.forEach((column) => {
            column.width = 3 // Ajusta el ancho mínimo de la columna
        });

        worksheet.getRow(6).height = 150;

        for (let row = 1; row <= lastRow; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cell = worksheet.getCell(row, col);

                if (row === 6) {
                    if (cell.value != "Latitud" && cell.value != "Longitud" && cell.value != "Poste") {
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: 'center',
                            wrapText: true,
                            textRotation: 90
                        };
                    }
                    else {
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: 'center',
                            wrapText: true,
                        };
                    }

                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF92CDDC' }
                    };
                } else if (row === 1 || row >= 5) {
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'center',
                        wrapText: true,

                    };
                }
                if (row >= 5) {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }

                if (cell.value === "Latitud" || cell.value === "Longitud" || cell.value === "Poste") {
                    worksheet.getColumn(col).width = 15;
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
            }
        }



        worksheet.getRow(5).eachCell(function (cell) {
            cell.font = { bold: true, size: 13, };
        });
        worksheet.getRow(6).eachCell(function (cell) {
            cell.font = { bold: true };
        });

        ///////////////////////Dsatos

        datos.map((hojita) => {

            const worksheetTemp = workbook.addWorksheet(`${hojita[0].poste?.ciudadA?.name}-${hojita[0].poste?.ciudadB?.name}`);

            //Datos
            for (let rowCount = 7; rowCount < hojita.length + 7; rowCount++) {

                const cell = worksheetTemp.getCell(rowCount, 1);
                console.log(hojita[rowCount - 7].poste)
                cell.value = hojita[rowCount - 7].poste?.name

                worksheet.eachRow({ includeEmpty: false }, (row) => {
                    // Obtener el primer valor de la fila actual
                    const primerValorFila = row.getCell(1).value;

                    // Verificar si el primer valor de la fila actual coincide con el valor de interés
                    if (primerValorFila === cell.value) {
                        // Copiar toda la fila a otra hoja o ubicación en la misma hoja (aquí se muestra cómo copiarla a otra hoja)
                        const nuevaFila = worksheetTemp.getRow(rowCount);
                        row.eachCell((cell, colNumber) => {
                            nuevaFila.getCell(colNumber).value = cell.value;
                        });
                    }
                });

            }


            for (let row = 5; row <= 6; row++) {
                for (let col = 1; col <= lastCol; col++) {
                    const cell1 = worksheet.getCell(row, col);
                    const cell2 = worksheetTemp.getCell(row, col);
                    cell2.value = cell1.value;
                }
            }

            let datosTemp = [[5, 1]]
            for (let col = 1; col <= lastCol; col++) {
                const cell1 = worksheetTemp.getCell(5, col);
                const cell2 = worksheetTemp.getCell(5, col + 1);
                if (cell2.value === cell1.value) {
                    datosTemp.push([5, col + 1])
                }
                else {
                    worksheetTemp.mergeCells(
                        datosTemp[0][0], datosTemp[0][1],
                        datosTemp[datosTemp.length - 1][0], datosTemp[datosTemp.length - 1][1],)
                    datosTemp = [[5, col + 1]]
                }
            }

            let lastRowTemp = 0;
            let lastColTemp = 0;
            worksheetTemp.eachRow({ includeEmpty: true }, function (row, rowNumber) {
                lastRowTemp = Math.max(lastRowTemp, rowNumber);
                row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
                    lastColTemp = Math.max(lastColTemp, colNumber);
                });
            });

            for (let i = 7; i <= lastRowTemp; i++) {
                const fila = worksheetTemp.getRow(i);
                fila.height = 15;
            }

            worksheetTemp.mergeCells(1, 1, 1, lastColTemp);
            worksheetTemp.mergeCells(2, 1, 2, 5);
            worksheetTemp.mergeCells(2, 6, 2, lastColTemp);
            worksheetTemp.mergeCells(3, 1, 3, 5);
            worksheetTemp.mergeCells(3, 6, 3, lastColTemp);
            worksheetTemp.mergeCells(4, 1, 4, 5);
            worksheetTemp.mergeCells(4, 6, 4, lastCol);

            worksheetTemp.getCell('A1').value = 'PLANILLA DE EVENTOS NACIONAL';
            worksheetTemp.getCell('A2').value = 'Tramo: ';

            worksheetTemp.getCell('A3').value = 'Fecha: ';
            worksheetTemp.getCell('A4').value = 'Elaborado por:';
            worksheetTemp.getCell('F2').value = `${hojita[0].poste?.ciudadA?.name} - ${hojita[0].poste?.ciudadB?.name}`;
            worksheetTemp.getCell('F3').value = filtro.fechaInicial?.toLocaleDateString() + ' - ' + filtro.fechaFinal?.toLocaleDateString();
            worksheetTemp.getCell('F4').value = "Lefitel";

            ['A2', 'A3', 'A4', 'F2', 'F3', 'F4'].map(key => {
                worksheetTemp.getCell(key).font = {
                    bold: true,
                    size: 15,
                };
            });


            worksheetTemp.getCell('A1').font = {
                bold: true,
                size: 20,
            };


            worksheetTemp.columns.forEach((column) => {
                column.width = 3 // Ajusta el ancho mínimo de la columna
            });

            worksheetTemp.getRow(6).height = 150;


            //Estilos
            for (let row = 1; row <= lastRowTemp; row++) {
                for (let col = 1; col <= lastColTemp; col++) {
                    const cell = worksheetTemp.getCell(row, col);

                    if (row === 6) {
                        if (cell.value != "Latitud" && cell.value != "Longitud" && cell.value != "Poste") {
                            cell.alignment = {
                                vertical: 'middle',
                                horizontal: 'center',
                                wrapText: true,
                                textRotation: 90
                            };
                        }
                        else {

                            cell.alignment = {
                                vertical: 'middle',
                                horizontal: 'center',
                                wrapText: true,
                            };
                        }
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF92CDDC' }
                        };
                    } else if (row === 1 || row >= 5) {
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: 'center',
                            wrapText: true,

                        };
                    }
                    if (row >= 5) {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    }
                    if (cell.value === "Latitud" || cell.value === "Longitud" || cell.value === "Poste") {
                        worksheetTemp.getColumn(col).width = 15;
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
                }
            }



            worksheetTemp.getRow(5).eachCell(function (cell) {
                cell.font = { bold: true, size: 13, };
            });
            worksheetTemp.getRow(6).eachCell(function (cell) {
                cell.font = { bold: true };
            });
        })






        setCargando(false)
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
            {cargando && (
                <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
                    <CircularProgress sx={{ color: "white" }} />
                </Box>
            )}
        </React.Fragment>
    )
}

export default ReporteTramoDialog