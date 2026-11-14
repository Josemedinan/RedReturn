import numpy as np
import pytest

from api.scientific.dem import DemTile


def make_tile(z: np.ndarray, lat_top: float = 0.5, lon_left: float = 10.0, deg: float = 0.0078125) -> DemTile:
    return DemTile(meta={"id": "syn", "name": "synthetic"}, z=z.astype(float), lon_left=lon_left, lat_top=lat_top, dlon=deg, dlat=deg)


@pytest.fixture()
def flat_tile():
    return make_tile(np.zeros((120, 120)))


@pytest.fixture(autouse=True)
def _reset_limits():
    from api import limits
    limits.reset()
    yield
    limits.reset()
