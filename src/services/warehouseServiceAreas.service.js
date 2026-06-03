"use strict";

const turf = require("@turf/turf");
const { WarehouseServiceArea, Warehouse } = require("../models");

function hasValidLatLng(address) {
    return (
        address?.lat !== null &&
        address?.lat !== undefined &&
        address?.lng !== null &&
        address?.lng !== undefined &&
        Number.isFinite(Number(address.lat)) &&
        Number.isFinite(Number(address.lng))
    );
}

function isValidPolygonGeoJson(boundary) {
    return (
        boundary &&
        boundary.type === "Polygon" &&
        Array.isArray(boundary.coordinates) &&
        Array.isArray(boundary.coordinates[0]) &&
        boundary.coordinates[0].length >= 4
    );
}

function isPointInsideBoundary({ address, boundary }) {
    if (!hasValidLatLng(address)) return false;
    if (!isValidPolygonGeoJson(boundary)) return false;

    const point = turf.point([
        Number(address.lng),
        Number(address.lat),
    ]);

    const polygon = turf.polygon(boundary.coordinates);

    return turf.booleanPointInPolygon(point, polygon);
}

async function findServiceableWarehouseForAddress({ address, t }) {
    const serviceAreas = await WarehouseServiceArea.findAll({
        where: {
            is_active: true,
        },
        include: [
            {
                model: Warehouse,
                as: "warehouse",
                required: true,
                where: {
                    is_active: true,
                },
            },
        ],
        order: [["created_at", "ASC"]],
        transaction: t,
    });

    const matchedArea = serviceAreas.find((serviceArea) =>
        isPointInsideBoundary({
            address,
            boundary: serviceArea.boundary_geojson,
        })
    );

    if (!matchedArea) {
        return null;
    }

    return {
        warehouse: matchedArea.warehouse,
        service_area: matchedArea,
    };
}

async function assertAddressServiceable({ address, t }) {
    return findServiceableWarehouseForAddress({ address, t });
}

module.exports = {
    findServiceableWarehouseForAddress,
    assertAddressServiceable,
    hasValidLatLng,
};