import React from "react";

const TestLocation = () => {

  const getLocation = () => {

    navigator.geolocation.getCurrentPosition(
      (position) => {

        console.log(
          "LAT : ",
          position.coords.latitude
        );

        console.log(
          "LNG : ",
          position.coords.longitude
        );

        alert(
          `LAT: ${position.coords.latitude}
LNG: ${position.coords.longitude}`
        );
      },
      (err) => {
        console.log(err);
      }
    );
  };

  return (
    <div style={{ padding: 30 }}>
      <button onClick={getLocation}>
        Get Office Location
      </button>
    </div>
  );
};

export default TestLocation;