import React, { useRef, useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton
} from '@ionic/react';
import './Policies.css';

const Policies: React.FC = () => {
    const contentRef = useRef<HTMLIonContentElement>(null);
    const [showBackToTop, setShowBackToTop] = useState(false);

    const handleScroll = (ev: CustomEvent) => {
        if (ev.detail.scrollTop > 300) {
            setShowBackToTop(true);
        } else {
            setShowBackToTop(false);
        }
    };

    const scrollToTop = () => {
        contentRef.current?.scrollToTop(500);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element && contentRef.current) {
            // Using IonContent's scroll behavior
            const yOffset = element.offsetTop;
            contentRef.current.scrollToPoint(0, yOffset, 500);
        }
    };

    return (
        <IonPage>
            <IonContent
                ref={contentRef}
                scrollEvents={true}
                onIonScroll={handleScroll}
                className="policies-ion-content"
            >
                <div className="policies-page">
                    {showBackToTop && (
                        <button className="back-to-top" title="Go to Top" onClick={scrollToTop}>
                            <i className="fas fa-chevron-up"></i>
                        </button>
                    )}

                    <div className="policies-container animate-entrance">
                        <header className="policies-header">
                            <i className="fas fa-university fa-4x" style={{ marginBottom: '20px' }}></i>
                            <h1>D Base Solutions Pvt Ltd</h1>
                            <div className="meta-info">
                                HR Policy Manual | Version 1.0 | Effective Date: 01/05/2026
                            </div>
                        </header>

                        <nav className="policies-toc">
                            <h2><i className="fas fa-compass"></i> Table of Contents</h2>
                            <ul>
                                <li><a onClick={() => scrollToSection('sec1')}>1. Employment & Onboarding</a></li>
                                <li><a onClick={() => scrollToSection('sec2')}>2. Compensation & Financials</a></li>
                                <li><a onClick={() => scrollToSection('sec3')}>3. Leave & Attendance</a></li>
                                <li><a onClick={() => scrollToSection('sec4')}>4. Performance & Recognition</a></li>
                                <li><a onClick={() => scrollToSection('sec5')}>5. Security Personnel Policy</a></li>
                                <li><a onClick={() => scrollToSection('sec6')}>6. POSH Policy</a></li>
                                <li><a onClick={() => scrollToSection('sec7')}>7. Workplace Discipline</a></li>
                                <li><a onClick={() => scrollToSection('sec8')}>8. Warning Slip System</a></li>
                                <li><a onClick={() => scrollToSection('sec9')}>9. Penalty & Escalation Matrix</a></li>
                                <li><a onClick={() => scrollToSection('sec10')}>10. Grievance & Exit Process</a></li>
                                <li><a onClick={() => scrollToSection('sec11')}>11. ISO Compliance & Audit Readiness</a></li>
                                <li><a onClick={() => scrollToSection('sec12')}>12. Benefits & Wellness</a></li>
                                <li><a onClick={() => scrollToSection('sec13')}>13. Data Privacy & Confidentiality</a></li>
                                <li><a onClick={() => scrollToSection('sec14')}>14. Code of Conduct & Ethics</a></li>
                            </ul>
                        </nav>

                        <main className="policies-main">
                            <section id="sec1" className="policies-section">
                                <h2>1. Employment & Onboarding</h2>
                                <h3>1.1 Applicability</h3>
                                <p>These policies apply to all employees of D Base Solutions Pvt Ltd, including permanent employees, probationary employees, contractual staff, consultants, interns, and trainees.</p>

                                <h3>1.2 Probation Period</h3>
                                <p>All newly hired employees shall undergo a mandatory probation period ranging from three (3) to six (6) months. During this period, the employee’s performance, conduct, attendance, and suitability for the role will be assessed.</p>

                                <h3>1.3 Background Verification</h3>
                                <p>The Company reserves the right to conduct background verification checks, including but not limited to:</p>
                                <ul>
                                    <li>Educational qualifications</li>
                                    <li>Previous employment records</li>
                                    <li>Identity verification</li>
                                    <li>Criminal background checks</li>
                                </ul>
                                <p>Any false information, concealment, or discrepancy found during verification may lead to immediate termination of employment.</p>

                                <h3>1.4 Employment Categories</h3>
                                <p>Employees may be classified into the following categories:</p>
                                <ul>
                                    <li>Probationary Employee</li>
                                    <li>Confirmed Employee</li>
                                    <li>Contractual / Consultant</li>
                                    <li>Intern / Trainee</li>
                                </ul>
                                <p>The terms and benefits applicable to each category may differ based on the employment agreement.</p>

                                <h3>1.5 Intellectual Property Rights</h3>
                                <ul>
                                    <li>All software code, documents, designs, inventions, databases, reports, client deliverables, and other work products created during the course of employment shall remain the sole and exclusive property of D Base Solutions Pvt Ltd.</li>
                                    <li>Employees are prohibited from sharing, copying, or reusing company intellectual property without written authorization.</li>
                                </ul>
                            </section>

                            <section id="sec2" className="policies-section">
                                <h2>2. Compensation & Financials</h2>
                                <h3>2.1 Payroll</h3>
                                <p>Salaries shall be processed and paid on a monthly basis as per the Company payroll schedule. Applicable statutory deductions may include: Provident Fund (PF), Employee State Insurance (ESI), Professional Tax, and Income Tax Deduction at Source (TDS).</p>

                                <h3>2.2 Overtime (OT)</h3>
                                <p>Overtime must be approved in advance by the Reporting Authority (RA). In case of emergency business requirements, system issues, production issues, client escalations, or urgent delivery commitments, employees may be allowed to work up to 3 hours of overtime without prior approval, subject to post-facto approval by the Reporting Authority or Management. Overtime compensation shall be applicable only when a single overtime session is at least 1.5 hours. Overtime compensation may be provided in one of the following forms:</p>
                                <ul>
                                    <li>Monetary payment</li>
                                    <li>Compensatory Off (Comp-Off)</li>
                                    <li>Permission time</li>
                                </ul>
                                <h4>Rules:</h4>
                                <ul>
                                    <li>For overtime greater than 1.5 hours and less than 4 hours, 50% of the overtime minutes worked shall be added as permission time.</li>
                                    <li>For overtime exceeding 4 hours, employees may be eligible for monetary payment subject to management approval.</li>
                                    <li>Maximum eligible overtime for calculation and approval shall generally be limited to 8 hours per month unless specifically approved by management.</li>
                                    <li>The mode of compensation shall depend on project budgets and management approval.</li>
                                    <li>Overtime compensation shall not be applicable for delays, rework, or issues caused due to employee mistakes, negligence, or non-compliance.</li>
                                </ul>

                                <h3>2.3 Salary Advance</h3>
                                <p>Salary advances may be granted only in exceptional cases such as: Medical emergencies, Personal emergencies, Family emergencies.</p>
                                <h4>Eligibility conditions:</h4>
                                <ul>
                                    <li>Minimum six (6) months of service</li>
                                    <li>Supporting documentation</li>
                                    <li>Approval from HR and Management</li>
                                    <li>Maximum advance amount shall be limited to 50% of the employee’s gross salary</li>
                                    <li>Salary advance shall be recovered within six (6) months in equal monthly installments (EMIs)</li>
                                    <li>Any new salary advance request shall be subject to clearance of previous advance dues</li>
                                    <li>Salary advance recovery shall commence only after a cooling period of 30 days from the date of advance disbursement</li>
                                </ul>
                            </section>

                            <section id="sec3" className="policies-section">
                                <h2>3. Leave & Attendance</h2>
                                <h3>3.1 Leave Application</h3>
                                <p>Employees must apply for leave through the approved leave management system at least one (1) day in advance, except in cases of emergency. Failure to obtain prior approval may result in leave being treated as Double Loss of Pay (Double LOP).</p>

                                <h3>3.2 Leave Entitlement</h3>
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Leave Type</th>
                                                <th>Tech Staff</th>
                                                <th>Non-Tech Staff</th>
                                                <th>Marketing Staff</th>
                                                <th>Onsite Staff</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>Casual Leave</td><td>12 days</td><td>12 days</td><td>12 days</td><td>12 days</td></tr>
                                            <tr><td>Sick Leave</td><td>12 days</td><td>4 days</td><td>4 days</td><td>2 days</td></tr>
                                            <tr><td>Maternity Leave</td><td colSpan={4}>3 months (Applicable only after completion of 3 years of service)</td></tr>
                                            <tr><td>Paternity Leave</td><td>2 days</td><td>2 days</td><td>2 days</td><td>2 days</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <ul>
                                    <li>Maternity Leave shall be applicable only after completion of 3 years of service</li>
                                    <li>Casual Leave shall be credited on a monthly pro-rata basis</li>
                                    <li>Additional sick leave may be considered upon submission of a valid certificate from a specialized doctor</li>
                                    <li>Unused Sick Leave may be carried forward or encashed only if permitted by Company policy</li>
                                    <li>Employees shall also be eligible for Company-declared public holidays and national holidays as notified by management from time to time</li>
                                    <li>Weekly holidays shall include every Sunday and the second Saturday of each month</li>
                                </ul>

                                <h3>3.3 Short Permissions</h3>
                                <p>Employees may avail short permissions subject to the following conditions:</p>
                                <ul>
                                    <li>Maximum session duration: 1 hour</li>
                                    <li>Maximum allowed permission sessions: <strong>6 per month</strong></li>
                                    <li>Technical Employees: 60 minutes of permission time per month without LOP</li>
                                    <li>Non-Technical Employees: 90 minutes of permission time per month without LOP</li>
                                    <li>Marketing Executives: 240 minutes of permission time per month without LOP</li>
                                    <li>Excess permission usage up to 3 hours per month, excluding allotted permission time, may be permitted subject to available permission time balance</li>
                                    <li>Excess permission usage up to 2 hours per month, excluding allotted permission time and without available permission time balance, shall attract Loss of Pay (LOP)</li>
                                    <li>Excess permission usage of more than 2 hours per month without available permission time, excluding allotted permission time, shall attract Double Loss of Pay (Double LOP). For Double LOP calculation, the allotted permission time shall also be included in the total</li>
                                    <li>Surplus unused permission time may be carried forward monthly and may be encashed at the end of the year subject to management approval</li>
                                    <li>Permission time procured after LOP calculation or slip issuance shall not be considered for withdrawal or reversal of past LOP or issued slips</li>
                                </ul>

                                <h3>3.4 On-Duty (OD)</h3>
                                <ul>
                                    <li>On-Duty requests must be submitted in advance with a clear business purpose</li>
                                    <li>Any absence without OD approval shall be treated as Loss of Pay (LOP)</li>
                                    <li>Employees using their own two-wheeler for approved On-Duty work may be eligible for travel reimbursement at the rate of Rs. 3 per kilometer</li>
                                    <li>Employees using their own four-wheeler for approved On-Duty work may be eligible for travel reimbursement at the rate of Rs. 10 per kilometer</li>
                                    <li>Employees on approved On-Duty assignment may also be eligible for a Daily Allowance (DA) of Rs. 250 per day (Breakfast: Rs. 50, Lunch: Rs. 100, Dinner: Rs. 100)</li>
                                    <li>Employees visiting client locations within 150 kilometers shall not be eligible for breakfast and dinner reimbursement and lunch reimbursement shall be limited to Rs. 150, subject to reporting time, return time, and management approval</li>
                                    <li>Geo-tagging and signed client visit slip are mandatory</li>
                                </ul>

                                <h3>3.5 Attendance Compliance</h3>
                                <ul>
                                    <li>Head Office and Branch Office reporting time: 9:30 AM</li>
                                    <li>Client Location / On-site reporting time: 10:00 AM</li>
                                    <li>Marketing Executives reporting time: 10:00 AM</li>
                                    <li>Lunch break: 1:30 PM to 2:30 PM</li>
                                    <li>Total eight grace occasions per month shall be allowed, consisting of four occasions of up to 15 minutes each and four occasions through allotted permission time</li>
                                    <li>Beyond eight late occasions and in the absence of available permission time, the total late time including the allotted 60 minutes grace time shall be treated as Loss of Pay (LOP)</li>
                                </ul>
                            </section>

                            <section id="sec4" className="policies-section">
                                <h2>4. Performance & Recognition</h2>
                                <h3>4.1 Performance Appraisal</h3>
                                <ul>
                                    <li>Any investment made by the Company towards employee skill development, certification programs, training, workshops, travel, accommodation, or external learning programs shall require employees to maintain a minimum attendance of 90%</li>
                                    <li>Failure to maintain the required 90% attendance may result in recovery of training costs, restriction from future training programs, penalties, or disciplinary action depending on the investment value, business urgency, and management decision</li>
                                    <li>Goals and Key Result Areas (KRAs): Productivity, Quality of work, Team collaboration, Attendance and discipline</li>
                                    <li>PC login and MyZen punch-in shall be completed within 10 minutes from the employee reporting time. Failure to complete punch-in within the permitted time may be treated as a late check-in and may be considered under attendance and performance evaluation</li>
                                    <li>Employees shall be allowed to shut down PCs and complete MyZen punch-out only after <strong>3 minutes</strong> from the official closing time. Any earlier checkout may be treated as early checkout and may be considered under attendance and performance evaluation</li>
                                </ul>

                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Factor</th>
                                                <th>Tech Staff</th>
                                                <th>Non-Tech Staff</th>
                                                <th>Field Mrkt. Staff</th>
                                                <th>Digital Mrkt. Staff</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>Productivity Score</td><td>25%</td><td>0%</td><td>0%</td><td>20%</td></tr>
                                            <tr><td>Punctuality Score</td><td>10%</td><td>20%</td><td>10%</td><td>10%</td></tr>
                                            <tr><td>Leave Score</td><td>10%</td><td>15%</td><td>5%</td><td>5%</td></tr>
                                            <tr><td>Permission Score</td><td>10%</td><td>15%</td><td>5%</td><td>5%</td></tr>
                                            <tr><td>Task Completion Score</td><td>20%</td><td>25%</td><td>10%</td><td>20%</td></tr>
                                            <tr><td>Client Feedback Score</td><td>15%</td><td>15%</td><td>0%</td><td>10%</td></tr>
                                            <tr><td>Company Policies Compliance Score</td><td>10%</td><td>10%</td><td>5%</td><td>10%</td></tr>
                                            <tr><td>Field Visit Score</td><td>0%</td><td>0%</td><td>10%</td><td>0%</td></tr>
                                            <tr><td>Business Development Score</td><td>0%</td><td>0%</td><td>10%</td><td>0%</td></tr>
                                            <tr><td>Lead Generation and Conversion Score</td><td>0%</td><td>0%</td><td>10%</td><td>10%</td></tr>
                                            <tr><td>Client Meeting and Follow-up Score</td><td>0%</td><td>0%</td><td>10%</td><td>0%</td></tr>
                                            <tr><td>Area Coverage and Market Reach Score</td><td>0%</td><td>0%</td><td>10%</td><td>0%</td></tr>
                                            <tr><td>Communication and Presentation Score</td><td>0%</td><td>0%</td><td>5%</td><td>0%</td></tr>
                                            <tr><td>Product / Service Knowledge Score</td><td>0%</td><td>0%</td><td>5%</td><td>0%</td></tr>
                                            <tr><td>Learning and Skill Improvement Score</td><td>0%</td><td>0%</td><td>5%</td><td>0%</td></tr>
                                            <tr><td>SEO / Campaign Performance Score</td><td>0%</td><td>0%</td><td>0%</td><td>10%</td></tr>
                                            <tr style={{ background: '#f1f5f9', fontWeight: 'bold' }}><td>Total</td><td>100%</td><td>100%</td><td>100%</td><td>100%</td></tr>
                                        </tbody>
                                    </table>
                                </div>

                                <h4>Grades:</h4>
                                <ul>
                                    <li>Grade O: Outstanding performance</li>
                                    <li>Grade A: Excellent performance</li>
                                    <li>Grade B: Good performance</li>
                                    <li>Grade C: Average performance</li>
                                    <li>Grade D: Needs Improvement</li>
                                    <li>Grade F: Unsatisfactory performance</li>
                                </ul>

                                <h3>4.2 Recognition & Rewards</h3>
                                <ul>
                                    <li>Employee of the Month awards</li>
                                    <li>Spot bonuses</li>
                                    <li>Performance incentives</li>
                                    <li>Appreciation certificates</li>
                                </ul>

                                <h3>4.3 Employee Engagement</h3>
                                <ul>
                                    <li>Team-building events</li>
                                    <li>Festival celebrations</li>
                                    <li>Employee engagement programs</li>
                                    <li>Potluck events</li>
                                    <li>Birthday celebrations</li>
                                </ul>

                                <h3>4.4 Referral Policy</h3>
                                <p>Employees who refer candidates for employment may be eligible for a referral bonus. The referral bonus shall be equal to 5% of the referred candidate’s salary and shall be payable only after the referred employee successfully completes the probation period.</p>
                            </section>

                            <section id="sec5" className="policies-section">
                                <h2>5. Security Personnel Policy</h2>
                                <h3>5.1 Security Responsibilities</h3>
                                <ul>
                                    <li>Security personnel shall be responsible for monitoring employee entry and exit, visitor movement, vehicle entry, and overall premises safety</li>
                                    <li>Security staff shall maintain visitor registers, vehicle logs, material inward and outward records, and attendance-related movement registers</li>
                                    <li>Security personnel shall ensure that all employees wear valid ID cards while entering or remaining inside the office premises</li>
                                </ul>
                                <h3>5.2 Visitor & Material Control</h3>
                                <ul>
                                    <li>Unauthorized visitors, vendors, or outsiders shall not be allowed inside the office premises without proper approval and visitor entry</li>
                                    <li>Security staff may inspect bags, laptops, parcels, or materials while entering or leaving the premises whenever required for security purposes</li>
                                </ul>
                                <h3>5.3 Employee Cooperation</h3>
                                <ul>
                                    <li>Employees shall cooperate with security personnel during security checks, audits, emergency situations, or investigations</li>
                                    <li>Security personnel shall immediately report any suspicious activity, safety issue, theft, damage, misconduct, or emergency to the Management or HR Department</li>
                                </ul>
                                <h3>5.4 Security Misconduct</h3>
                                <ul>
                                    <li>Sleeping during duty hours, negligence, absence from assigned security points, misuse of CCTV systems, or failure to report incidents may result in disciplinary action against security personnel</li>
                                    <li>Security personnel may be required to work in rotational shifts, weekends, holidays, or emergency duty schedules based on business requirements</li>
                                </ul>
                            </section>

                            <section id="sec6" className="policies-section">
                                <h2>6. POSH Policy</h2>
                                <h3>6.1 Prevention of Sexual Harassment</h3>
                                <ul>
                                    <li>D Base Solutions Pvt Ltd is committed to providing a safe, secure, and respectful workplace for all employees</li>
                                    <li>Sexual harassment in any form shall not be tolerated within the workplace, during business travel, client visits, meetings, training sessions, online communication, or work-related events</li>
                                </ul>
                                <h3>6.2 Complaint & Investigation</h3>
                                <ul>
                                    <li>Employees may report incidents of harassment to HR, Management, or the Internal Complaints Committee (ICC)</li>
                                    <li>All complaints shall be handled confidentially and investigated fairly without retaliation against the complainant</li>
                                </ul>
                                <h3>6.3 Action Against Misconduct</h3>
                                <p>Any employee found guilty of sexual harassment may face disciplinary action including written warning, suspension, termination, police complaint, or legal action depending on the seriousness of the matter.</p>
                            </section>

                            <section id="sec7" className="policies-section">
                                <h2>7. Workplace Discipline</h2>
                                <h3>7.1 English Communication</h3>
                                <p>English Comms: Mandatory for all official emails, documentation, meetings, and client interaction.</p>

                                <h3>7.2 Mobile Phone Usage</h3>
                                <p>Employees are strictly prohibited from speaking loudly, attending phone calls in a disturbing manner, or creating unnecessary noise within the office premises.</p>

                                <h3>7.3 Unnecessary Gatherings</h3>
                                <p>Employees shall not engage in unnecessary gatherings, standing in groups, casual clustering, prolonged discussions, or crowding in work areas during working hours unless there is a defined business purpose.</p>

                                <h3>7.4 Food & Pantry Usage</h3>
                                <p>Food: Consumption only in designated pantry/dining areas; prohibited at workstations. Eating at workstations is strictly prohibited.</p>

                                <h3>7.5 Social Media Usage</h3>
                                <ul>
                                    <li>Share confidential company information</li>
                                    <li>Share client information</li>
                                    <li>Post derogatory comments about the Company</li>
                                    <li>Misuse company branding or reputation on social media</li>
                                </ul>

                                <h3>7.6 Mandatory Usage of ID Card</h3>
                                <p>Wearing the Company ID card is mandatory during all working hours.</p>

                                <h3>7.7 Dress Code</h3>
                                <p>Dress Code: Professional dress mandatory (torn jeans/slippers prohibited). Saturday attire is own-choice. Employees are expected to maintain a neat, clean, and professional appearance during working hours.</p>
                                <ul>
                                    <li>Casual dress may be permitted on regular working days, provided the attire remains decent and workplace appropriate.</li>
                                    <li>If the Company provides official branded clothing, employees may be required to wear such clothing on the last working day of every week.</li>
                                    <li>Marketing team members may be required to wear blazers, formal shoes, ID cards, and business attire during client meetings, presentations, and business visits.</li>
                                    <li>Employees attending client meetings, interviews, official presentations, or management reviews shall wear formal attire irrespective of the day.</li>
                                    <li>Inappropriate, revealing, offensive, or unprofessional clothing shall not be permitted in the workplace.</li>
                                    <li>Repeated dress code violations may result in verbal warning, Yellow Slip, or disciplinary action.</li>
                                </ul>
                            </section>

                            <section id="sec8" className="policies-section">
                                <h2>8. Warning Slip System</h2>
                                <ul>
                                    <li>Green Slip carries a positive score of 0.07</li>
                                    <li>Yellow Slip carries a negative score of -0.07</li>
                                    <li>Orange Slip carries a negative score of -0.70</li>
                                    <li>Red Slip carries a negative score of -3.0</li>
                                </ul>
                                <p>Slip scores shall be considered during employee performance evaluation and may impact the overall employee score on the 5-point performance scale.</p>
                                <ul>
                                    <li>Employees may be encouraged to report policy violations observed by other employees with proper evidence, timestamps, and CCTV review support.</li>
                                    <li>Upon HR and Management approval, equal Yellow Slip(s) may be withdrawn as an incentive for identifying and reporting a valid policy violation.</li>
                                    <li>In case there are no Yellow Slips available for withdrawal, equal Green Slip(s) may be issued instead.</li>
                                    <li>Green Slips may be issued for exceptional punctuality, zero late coming, positive client feedback, support during audits, helping management, extra work contribution, or identifying valid policy violations.</li>
                                    <li>One Green Slip may offset one Yellow Slip. Green Slips shall not offset Orange Slips or Red Slips.</li>
                                    <li>Eight Yellow Slips may lead to one Orange Slip. Four Orange Slips may lead to one Red Slip.</li>
                                    <li>Yellow and Green Slips may generally remain active for 6 months, Orange Slips for 12 months, and Red Slips for 24 months unless otherwise decided by management.</li>
                                    <li>All slips shall be displayed in the Employee Dashboard within the Office Portal.</li>
                                    <li>Employees may appeal against any slip within 3 working days from the date of issue.</li>
                                    <li>CCTV review requests or complaints should normally be submitted within 7 days from the date of the incident.</li>
                                    <li>Serious misconduct such as theft, violence, harassment, fraud, data theft, substance abuse, severe client misconduct, or illegal activities may directly attract a Red Slip, suspension, legal action, or termination without prior Yellow or Orange Slip.</li>
                                    <li>Based on the review outcome, one identified defaulter may be served an Orange Slip and the initially issued Yellow Slip may be withdrawn.</li>
                                </ul>
                            </section>

                            <section id="sec9" className="policies-section">
                                <h2>9. Penalty & Escalation Matrix</h2>
                                <div className="penalty-grid">
                                    <div className="penalty-card">
                                        <div className="card-title">9.1 Excess Permissions</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Immediate</div>
                                        <div className="card-desc">Every additional 60 minutes beyond allotted permission time and the maximum permitted 6 permission sessions shall attract +1 Slip or +1 Slip for every 3 excess permission instances, whichever is higher.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.2 Unauthorized Leave / OD</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Day</div>
                                        <div className="card-desc">Absence from work without prior approved leave or valid On-Duty documentation. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.3 Personal Mobile Misuse</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Speaking loudly, attending disturbing calls, or unnecessary personal device usage in work areas. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.4 Unnecessary Gatherings</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Standing in groups, casual clustering, or prolonged non-business discussions in work areas. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.5 Failure to Wear ID Card</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per 2 Instances</div>
                                        <div className="card-desc">Failure to display the valid Company ID card during any working hours. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.6 Late Coming</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Immediate</div>
                                        <div className="card-desc">After eight late instances, including permission time if used for up to four instances, every additional 60 minutes shall attract +1 Slip or +1 Slip for every 3 late instances, whichever is higher.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.7 Food / Hygiene Violation</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per 2 Instances</div>
                                        <div className="card-desc">Consuming food at workstations or violating designated pantry/dining area rules. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.8 Client / On-site Misconduct</div>
                                        <div className="card-row"><strong>Applicable For:</strong> Applicable Staff</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Unprofessional behavior, negligence, or non-compliance during client visits or on-site assignments. Count: 1.</div>
                                        <div className="card-badge bg-red">Red Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.9 Dress Code Violation</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per 2 Instances</div>
                                        <div className="card-desc">Wearing prohibited attire such as torn jeans, shorts, or bathroom slippers. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.10 Sleeping During Duty</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Sleeping or showing extreme negligence during official working hours. Count: 3.</div>
                                        <div className="card-badge bg-orange">Yellow Slip (3)</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.11 Failure to Comms in English</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per 3 Instances</div>
                                        <div className="card-desc">Failure to use English for emails, documentation, meetings, and client communication. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.12 MyZen Compliance</div>
                                        <div className="card-row"><strong>Applicable For:</strong> Tech Staff / Admin</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per 3 Instances</div>
                                        <div className="card-desc">Late PC login/MyZen punch-in or early checkout without RA approval. Count: 1.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.13 Data Breach / Fraud</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Illegal transactions, misuse of company funds, or unauthorized disclosure of confidential data. Count: 1.</div>
                                        <div className="card-badge bg-red">Red Slip</div>
                                    </div>
                                    <div className="penalty-card">
                                        <div className="card-title">9.14 Disobedience / Quarrel</div>
                                        <div className="card-row"><strong>Applicable For:</strong> All Employees</div>
                                        <div className="card-row"><strong>Frequency:</strong> Per Instance</div>
                                        <div className="card-desc">Refusal to follow instructions or engaging in verbal/physical fights. Count: 1 for Each involved person.</div>
                                        <div className="card-badge bg-yellow">Yellow Slip</div>
                                    </div>
                                </div>
                            </section>

                            <section id="sec10" className="policies-section">
                                <h2>10. Grievance Handling & Exit Process</h2>
                                <h3>10.1 Grievance Redressal</h3>
                                <ul>
                                    <li>Reporting Authority</li>
                                    <li>Human Resources Department</li>
                                    <li>Management</li>
                                </ul>
                                <h3>10.2 Separation & Notice Period</h3>
                                <p>Employees resigning from the Company must serve the notice period mentioned in their appointment letter. The notice period allows for proper knowledge transfer and transition of responsibilities.</p>
                                <h3>10.3 Full & Final Settlement</h3>
                                <ul>
                                    <li>Completion of notice period</li>
                                    <li>Return of company property</li>
                                    <li>Clearance from all relevant departments</li>
                                </ul>
                                <h3>10.4 Return of Company Assets</h3>
                                <ul>
                                    <li>Laptop / Desktop</li>
                                    <li>ID card</li>
                                    <li>Access cards</li>
                                    <li>Documents</li>
                                    <li>Storage devices</li>
                                    <li>Other company-owned property</li>
                                </ul>
                            </section>

                            <section id="sec11" className="policies-section">
                                <h2>11. ISO Compliance & Audit Readiness</h2>
                                <h3>11.1 ISO Policy Compliance</h3>
                                <p>All employees are required to strictly follow ISO policies, procedures, documentation standards, and process guidelines applicable to their respective departments and roles.</p>
                                <h3>11.2 Audit Preparedness</h3>
                                <ul>
                                    <li>Maintain proper documentation and records</li>
                                    <li>Follow approved processes and SOPs</li>
                                    <li>Ensure data accuracy and traceability</li>
                                    <li>Keep workstations, systems, and files organized</li>
                                    <li>Cooperate fully with audit teams and management</li>
                                    <li>Address any non-conformities or corrective actions promptly</li>
                                </ul>
                                <h3>11.3 Non-Compliance</h3>
                                <p>Failure to follow ISO procedures, maintain records, or comply with audit requirements may result in corrective action, disciplinary measures, or escalation to management.</p>
                                <h3>11.4 Department Responsibility</h3>
                                <p>Department Heads and Reporting Authorities are responsible for ensuring that their teams are aware of and comply with all ISO-related requirements and audit readiness measures.</p>
                            </section>

                            <section id="sec12" className="policies-section">
                                <h2>12. Benefits & Wellness</h2>
                                <h3>12.1 Health & Medical Insurance</h3>
                                <ul>
                                    <li>The Company may provide Group Health Insurance coverage to confirmed employees subject to the policy terms and conditions of the designated insurance provider</li>
                                    <li>Insurance coverage may be extended to immediate family members, including spouse and dependent children, at the employee's own cost subject to policy terms</li>
                                    <li>Pre-existing diseases, waiting periods, and exclusions shall be governed by the insurance provider's master policy terms</li>
                                    <li>Employees shall submit all medical claims through HR within the timelines specified by the insurance provider</li>
                                </ul>
                                <h3>12.2 Employee Wellness Programs</h3>
                                <ul>
                                    <li>The Company may organize health check-up camps, wellness sessions, ergonomic assessments, fitness programs, or counseling support for employees</li>
                                    <li>Participation in wellness programs may be voluntary unless specifically mandated by Management</li>
                                    <li>The Company may also organize sports events, annual trips, cultural events, employee outings, and recreational activities for employee engagement and morale improvement</li>
                                </ul>
                                <h3>12.3 Financial Support & Benefits</h3>
                                <ul>
                                    <li>Employees may be eligible for festival advances, emergency support, referral incentives, attendance awards, or special recognition benefits based on Company policy and Management approval</li>
                                    <li>Any such benefits shall be purely discretionary and may vary depending on business performance and employee eligibility</li>
                                </ul>
                                <h3>12.4 Work Environment</h3>
                                <ul>
                                    <li>The Company shall strive to provide a safe, healthy, clean, and comfortable work environment for all employees</li>
                                    <li>Employees are expected to maintain cleanliness, hygiene, and proper usage of office furniture, pantry facilities, washrooms, meeting rooms, and common areas</li>
                                </ul>
                            </section>

                            <section id="sec13" className="policies-section">
                                <h2>13. Data Privacy & Confidentiality</h2>
                                <h3>13.1 Confidential Information</h3>
                                <ul>
                                    <li>Employees shall not disclose, share, copy, or misuse any confidential information belonging to the Company, clients, vendors, or business partners during or after employment</li>
                                    <li>Confidential information may include financial data, source code, trade secrets, algorithms, client databases, employee information, business strategies, pricing details, and project documentation</li>
                                    <li>Employees shall not remove confidential documents, files, or devices from office premises without authorization</li>
                                    <li>Unauthorized photography, screen recording, data copying, or sharing of office information is strictly prohibited</li>
                                </ul>
                                <h3>13.2 Data Security Obligations</h3>
                                <ul>
                                    <li>Employees shall follow all data security protocols including password policies, access control rules, clean desk policy, system lock requirements, and device security procedures</li>
                                    <li>Sharing passwords, login credentials, access tokens, OTPs, or confidential files with unauthorized persons is strictly prohibited</li>
                                    <li>Employees must immediately report any data breach, phishing attempt, malware incident, suspicious email, or security vulnerability to HR and IT Department</li>
                                    <li>Employees shall not install unauthorized software, use pirated applications, or connect unknown external devices to Company systems</li>
                                    <li>Personal devices used for office work may be subject to Company security requirements</li>
                                </ul>
                                <h3>13.3 Non-Disclosure Agreement (NDA)</h3>
                                <p>All employees shall sign a Non-Disclosure Agreement at the time of joining. The confidentiality obligations under the NDA shall continue even after resignation or termination for the duration specified in the agreement. Violation results in disciplinary action, termination, financial recovery, legal notice, or court proceedings.</p>
                                <h3>13.4 System & Internet Usage</h3>
                                <ul>
                                    <li>Company systems, internet connections, email accounts, software, and communication tools shall be used strictly for official purposes</li>
                                    <li>Employees shall not access inappropriate websites, download illegal content, or misuse office internet resources</li>
                                    <li>The Company reserves the right to monitor emails, internet usage, CCTV footage, system logs, access records, and communication channels for security and compliance purposes</li>
                                </ul>
                            </section>

                            <section id="sec14" className="policies-section">
                                <h2>14. Code of Conduct & Ethics</h2>
                                <h3>14.1 Conflict of Interest</h3>
                                <ul>
                                    <li>Employees shall avoid any situation where their personal interest conflicts with Company interest</li>
                                    <li>Secondary employment, freelancing, consulting work, or side business activity shall require prior written approval from Management</li>
                                    <li>Any personal business relationship, financial interest, or investment with vendors, clients, or competitors shall be disclosed to HR and Management</li>
                                </ul>
                                <h3>14.2 Anti-Bribery & Corruption</h3>
                                <p>The Company follows a zero-tolerance approach towards bribery, corruption, kickbacks, and unethical business practices. Employees shall not offer, promise, request, accept, or facilitate any bribe, gift, commission, or improper advantage from any party. Any bribery request, corruption attempt, or unethical demand shall be reported immediately to HR or Management.</p>
                                <h3>14.3 Substance Abuse</h3>
                                <p>Consumption of alcohol, narcotics, or illegal drugs during office hours, within office premises, client locations, or during official duties is strictly prohibited. Reporting to work under the influence of alcohol or drugs shall be treated as severe misconduct. Violations result in suspension, Red Slip, termination, police complaint, or legal action.</p>
                                <h3>14.4 Ethical Behaviour</h3>
                                <ul>
                                    <li>Employees are expected to behave honestly, respectfully, and professionally with colleagues, clients, vendors, visitors, and all other stakeholders</li>
                                    <li>Misrepresentation, cheating, falsification of records, impersonation, or unethical conduct shall not be tolerated</li>
                                    <li>Employees shall protect the reputation, goodwill, and business interests of the Company at all times</li>
                                </ul>
                                <h3>14.5 Compliance with Laws</h3>
                                <p>Employees shall comply with all applicable laws, rules, regulations, and statutory requirements relevant to their role and responsibilities. Any violation of legal or regulatory requirements may result in disciplinary action in addition to any legal consequences.</p>
                            </section>

                            <div style={{ background: '#fff8e1', borderLeft: '5px solid #f59e0b', padding: '30px', marginTop: '60px', borderRadius: '12px', fontWeight: 500 }}>
                                <strong>Note:</strong> The Company reserves the right to amend, modify, or update these policies at any time based on business requirements, statutory changes, or management decisions.
                            </div>
                        </main>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Policies;  