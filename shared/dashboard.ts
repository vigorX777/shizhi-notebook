export type ActivityItem={id:string;kind:'archive'|'review';at:string;noteIds:string[];titles:string[];subjects:string[]};
export type ActivityDay={date:string;archives:number;reviews:number;total:number;items:ActivityItem[]};
export type SubjectSummary={subject:string;total:number;mastered:number;review:number;unmarked:number;incomplete:number};
export type DashboardData={period:'90d'|'year';today:string;subjects:SubjectSummary[];summary:{totalNotes:number;mastered:number;activeDays:number;weeklyReviews:number};days:ActivityDay[];weeks:{start:string;end:string;reviews:number}[]};
