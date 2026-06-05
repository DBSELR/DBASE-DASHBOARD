import React,
{
  useEffect,
  useState
}
from "react";

import axios
from "axios";

import { API_BASE }
from "../config";

function ViolationApproval()
{
  const [reports,
    setReports] =
    useState<any[]>([]);

  useEffect(() =>
  {
    loadReports();
  }, []);

  const loadReports =
    async () =>
    {
      const res =
        await axios.get(
          `${API_BASE}Penalty/GetPendingViolationReports`
        );

      setReports(
        res.data || []
      );
    };

  const approve =
    async (id:number) =>
    {
      await axios.post(
        `${API_BASE}Penalty/ApproveViolationReport?reportId=${id}&reviewedBy=ADMIN`
      );

      loadReports();
    };

  const reject =
    async (id:number) =>
    {
      const remarks =
        prompt(
          "Reject Reason"
        );

      if(!remarks)
        return;

      await axios.post(
        `${API_BASE}Penalty/RejectViolationReport`,
        {
          reportId:id,
          reviewedBy:"ADMIN",
          remarks
        }
      );

      loadReports();
    };

  return (

    <div className="meeting-page">

      <div className="meeting-card">

        <h2>
          Pending Violation Reports
        </h2>

        <table
          className="meeting-table"
        >

          <thead>

            <tr>

              <th>
                Reporter
              </th>

              <th>
                Violator
              </th>

              <th>
                Time
              </th>

              <th>
                Remarks
              </th>

              <th>
                Proof
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>

          <tbody>

            {
              reports.map(
                (r) => (

                  <tr
                    key={r.Id}
                  >

                    <td>
                      {
                        r.ReporterName
                      }
                    </td>

                    <td>
                      {
                        r.ViolatorName
                      }
                    </td>

                    <td>
                      {
                        new Date(
                          r.ViolationTime
                        )
                        .toLocaleString()
                      }
                    </td>

                    <td>
                      {
                        r.Remarks
                      }
                    </td>

                    <td>

                      {
                        r.ProofFilePath ?

                        <a
                          href={
                            `${API_BASE.replace(
                              "api/",
                              ""
                            )}${r.ProofFilePath}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>

                        :

                        "-"
                      }

                    </td>

                    <td>

                      <button
                        onClick={() =>
                          approve(
                            r.Id
                          )
                        }
                      >
                        Approve
                      </button>

                      <button
                        style={{
                          marginLeft:
                            "10px"
                        }}
                        onClick={() =>
                          reject(
                            r.Id
                          )
                        }
                      >
                        Reject
                      </button>

                    </td>

                  </tr>

                )
              )
            }

          </tbody>

        </table>

      </div>

    </div>

  );
}

export default ViolationApproval;