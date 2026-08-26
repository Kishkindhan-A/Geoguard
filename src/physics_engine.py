"""
GeoGuard AI — Geotechnical Kinematics & Hydrostatic Physics Engine

Computes Romana's Slope Mass Rating (SMR) adjustments and the
physics-governed Factor of Safety (FoS) for open-pit mine slopes.
"""

from __future__ import annotations

from typing import Optional

# ---------------------------------------------------------------------------
# Input clamping helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Romana's SMR Adjustment Factors
# ---------------------------------------------------------------------------

def _dip_adjustment_F1(
    joint_dip: float,
    joint_dip_direction: float,
    slope_dip: float,
    slope_dip_direction: float,
) -> float:
    """Parallelism between joint dip direction and slope dip direction.

    Returns an F1 rating in [-1.0, 0.0] per the Romana scale.
    """
    alpha_diff = abs(joint_dip_direction - slope_dip_direction) % 360
    if alpha_diff > 180:
        alpha_diff = 360 - alpha_diff

    if alpha_diff <= 20:
        return 0.0
    elif alpha_diff <= 30:
        return -0.2
    elif alpha_diff <= 45:
        return -0.4
    elif alpha_diff <= 70:
        return -0.6
    elif alpha_diff <= 85:
        return -0.8
    return -1.0


def _dip_adjustment_F2(joint_dip: float) -> float:
    """Joint dip angle adjustment (planning condition).

    Returns F2 in [-1.0, 0.0].
    """
    if joint_dip < 10:
        return 0.0
    elif joint_dip <= 20:
        return -0.2
    elif joint_dip <= 30:
        return -0.4
    elif joint_dip <= 40:
        return -0.6
    elif joint_dip <= 50:
        return -0.8
    elif joint_dip <= 60:
        return -0.9
    return -1.0


def _dip_adjustment_F3(joint_dip: float, slope_dip: float) -> float:
    """Relationship between joint dip and slope dip.

    Returns F3 in [-1.0, 1.0].
    """
    if joint_dip > slope_dip:
        return -1.0 * (joint_dip - slope_dip) / 90.0
    slope_minus_joint = slope_dip - joint_dip
    if slope_minus_joint < 10:
        return -0.5 * slope_minus_joint
    elif slope_minus_joint <= 20:
        return -0.5 * slope_minus_joint + 0.2
    return 0.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_smr(
    rmr_basic: float,
    slope_angle: float,
    ru: float,
    *,
    joint_dip: float = 35.0,
    joint_dip_direction: float = 180.0,
    slope_dip_direction: float = 0.0,
) -> float:
    """Calculate Romana's Slope Mass Rating (SMR).

    Parameters
    ----------
    rmr_basic : float
        Bieniawski basic Rock Mass Rating (0-100). Clamped.
    slope_angle : float
        Designed slope face angle in degrees (0-90). Clamped.
    ru : float
        Pore-pressure ratio 0.0-1.0. Clamped.

    Returns
    -------
    float
        Adjusted SMR value (0-100).  Higher is more stable.
    """
    rmr_basic = _clamp(rmr_basic, 0.0, 100.0)
    ru = _clamp(ru, 0.0, 1.0)
    slope_angle = _clamp(slope_angle, 0.0, 90.0)

    F1 = _dip_adjustment_F1(joint_dip, joint_dip_direction, slope_angle, slope_dip_direction)
    F2 = _dip_adjustment_F2(joint_dip)
    F3 = _dip_adjustment_F3(joint_dip, slope_angle)

    adjustment = F1 * F2 * F3
    smr = rmr_basic + (15.0 + adjustment) * (1.0 - 0.5 * ru)
    return round(_clamp(smr, 0.0, 100.0), 2)


def compute_physics_fos(
    smr_score: float,
    ru: float,
    jv_density: float,
) -> float:
    """Compute physics-governed Factor of Safety (FoS).

    The empirical relationship::

        FoS = (SMR / 35.0) * (1.5 - ru) * (15 / Jv)^0.2

    Parameters
    ----------
    smr_score : float
        Slope Mass Rating (0-100). Clamped.
    ru : float
        Pore-pressure ratio (0-1). Clamped.
    jv_density : float
        Joint Volumetric Count (joints/m3). Clamped to minimum of 1.0.

    Returns
    -------
    float
        Calculated Factor of Safety (always > 0).
    """
    smr_score = _clamp(smr_score, 0.0, 100.0)
    ru = _clamp(ru, 0.0, 1.0)
    jv_density = _clamp(jv_density, 1.0, 200.0)

    ratio_smr = smr_score / 35.0
    pore_factor = 1.5 - ru
    jv_factor = (15.0 / jv_density) ** 0.2

    fos = ratio_smr * pore_factor * jv_factor
    return round(max(fos, 0.01), 4)
