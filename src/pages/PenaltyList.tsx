import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

import { API_BASE } from "../config";

import {
  IonIcon
} from "@ionic/react";

import {
  chevronDownOutline,
  chevronForwardOutline,
  documentTextOutline
} from "ionicons/icons";

import "./PenaltyList.css";

function PenaltyList() {

  const [employees, setEmployees] =
    useState<any[]>([]);

  const [filteredEmployees,
    setFilteredEmployees] =
    useState<any[]>([]);

  const [expandedEmp,
    setExpandedEmp] =
    useState<string | null>(null);

  const [details,
    setDetails] =
    useState<any>({});

  const [search,
    setSearch] =
    useState("");

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {

    const filtered =
      employees.filter((e) =>
        e.EMPNAME
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        e.EMPCODE
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );

    setFilteredEmployees(
      filtered
    );

  }, [search, employees]);

  const loadSummary =
    async () => {

      try {

        const res =
          await axios.get(
            `${API_BASE}Penalty/GetEmployeeSlipSummary`
          );

        setEmployees(
          res.data || []
        );

        setFilteredEmployees(
          res.data || []
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const toggleEmployee =
    async (
      empCode: string
    ) => {

      try {

        if (
          expandedEmp === empCode
        ) {

          setExpandedEmp(
            null
          );

          return;
        }

        if (
          !details[empCode]
        ) {

          const res =
            await axios.get(
              `${API_BASE}Penalty/GetEmployeePenaltyDetails/${empCode}`
            );

          setDetails(
            (
              prev: any
            ) => ({
              ...prev,
              [empCode]:
                res.data || []
            })
          );
        }

        setExpandedEmp(
          empCode
        );

      }
      catch (err) {

        console.error(err);

      }
    };

  const getProofUrl =
    (path: string) => {

      if (!path)
        return "";

      return `${API_BASE.replace(
        "api/",
        ""
      )}${path}`;

    };

  return (

    <div className="penalty-page">

      <div className="penalty-card">

        <div className="page-header">

          <h2>
            Employee Penalties
          </h2>

        </div>

        <div
          className="search-box"
        >

          <input
            type="text"
            placeholder="Search Employee..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        <div
          className="table-wrapper"
        >

          <table
            className="summary-table"
          >

            <thead>

              <tr>

                <th></th>

                <th>
                  Employee Code
                </th>

                <th>
                  Employee Name
                </th>

                <th>
                  Yellow Slips
                </th>

                <th>
                  Red Slips
                </th>

                <th>
                  Escalation
                </th>

              </tr>

            </thead>

            <tbody>

              {
                filteredEmployees.map(
                  (emp) => (

                    <React.Fragment
                      key={
                        emp.EMPCODE
                      }
                    >

                      <tr
                        className="employee-row"
                        onClick={() =>
                          toggleEmployee(
                            emp.EMPCODE
                          )
                        }
                      >

                        <td>

                          <IonIcon
                            icon={
                              expandedEmp ===
                                emp.EMPCODE
                                ?
                                chevronDownOutline
                                :
                                chevronForwardOutline
                            }
                          />

                        </td>

                        <td>
                          {emp.EMPCODE}
                        </td>

                        <td>
                          {emp.EMPNAME}
                        </td>

                        <td>

                          <span
                            className="yellow-badge"
                          >
                            {
                              emp.YellowSlips
                            }
                          </span>

                        </td>

                        <td>

                          <span
                            className="red-badge"
                          >
                            {
                              emp.RedSlips
                            }
                          </span>

                        </td>

                        <td>

                         <span
  className={
    emp.EscalationStatus === "Normal"
      ? "normal-status"
      : emp.EscalationStatus === "HR Warning"
      ? "warning-status"
      : "warning-status"
  }
>

                            {
                              emp.EscalationStatus
                            }

                          </span>

                        </td>

                      </tr>

                      {
                        expandedEmp ===
                          emp.EMPCODE && (

                            <tr>

                              <td
                                colSpan={6}
                              >

                                <div
                                  className="detail-container"
                                >

                                  <table
                                    className="detail-table"
                                  >

                                    <thead>

                                      <tr>

                                        <th>
                                          Penalty Date
                                        </th>

                                        <th>
                                          Violation Time
                                        </th>

                                        <th>
                                          Slip Type
                                        </th>

                                        <th>
                                          Count
                                        </th>

                                        <th>
                                          Remarks
                                        </th>

                                        <th>
                                          Status
                                        </th>

                                        <th>
                                          Proof
                                        </th>

                                      </tr>

                                    </thead>

                                    <tbody>

                                      {
                                        details[
                                          emp.EMPCODE
                                        ]?.map(
                                          (
                                            d: any
                                          ) => (

                                            <tr
                                              key={
                                                d.Id
                                              }
                                            >

                                              <td>
                                                {
                                                  new Date(
                                                    d.PenaltyDate
                                                  )
                                                    .toLocaleDateString()
                                                }
                                              </td>

                                              <td>

                                                {
                                                  d.ViolationTime
                                                    ?
                                                    new Date(
                                                      d.ViolationTime
                                                    )
                                                      .toLocaleString()
                                                    :
                                                    "-"
                                                }

                                              </td>

                                              <td>
                                                {
                                                  d.SlipType
                                                }
                                              </td>

                                              <td>
                                                {
                                                  d.SlipCount
                                                }
                                              </td>

                                              <td>
                                                {
                                                  d.Remarks
                                                }
                                              </td>

                                              <td>
                                                {
                                                  d.Status
                                                }
                                              </td>

                                              <td>

                                                {
                                                  d.ProofFilePath
                                                    ?

                                                    <a
                                                      href={getProofUrl(
                                                        d.ProofFilePath
                                                      )}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="view-proof-btn"
                                                    >
                                                      <IonIcon icon={documentTextOutline} />
                                                      View Proof
                                                    </a>

                                                    :

                                                    "-"
                                                }

                                              </td>

                                            </tr>

                                          )
                                        )
                                      }

                                    </tbody>

                                  </table>

                                </div>

                              </td>

                            </tr>

                          )
                      }

                    </React.Fragment>

                  )
                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );
}

export default PenaltyList;